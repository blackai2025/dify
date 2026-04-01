import math
from collections import Counter

import numpy as np

from core.model_manager import ModelManager
from core.model_runtime.entities.model_entities import ModelType
from core.rag.datasource.keyword.jieba.jieba_keyword_table_handler import JiebaKeywordTableHandler
from core.rag.embedding.cached_embedding import CacheEmbedding
from core.rag.filter.filter_rule_loader import FilterRuleLoader
from core.rag.index_processor.constant.doc_type import DocType
from core.rag.index_processor.constant.query_type import QueryType
from core.rag.models.document import Document
from core.rag.rerank.entity.weight import VectorSetting, Weights
from core.rag.rerank.rerank_base import BaseRerankRunner


class WeightRerankRunner(BaseRerankRunner):
    PRICE_SIGNAL_KEYWORDS = (
        "预估到手价",
        "下单链接",
        "跟团流程",
        "赠品权益",
        "国补",
        "费用说明",
        "价格",
    )

    def __init__(self, tenant_id: str, weights: Weights):
        self.tenant_id = tenant_id
        self.weights = weights

    def run(
        self,
        query: str,
        documents: list[Document],
        score_threshold: float | None = None,
        top_n: int | None = None,
        user: str | None = None,
        query_type: QueryType = QueryType.TEXT_QUERY,
    ) -> list[Document]:
        """
        Run rerank model
        :param query: search query
        :param documents: documents for reranking
        :param score_threshold: score threshold
        :param top_n: top n
        :param user: unique user id if needed

        :return:
        """
        unique_documents = []
        doc_ids = set()
        seen_contents = set()
        for document in documents:
            if document.page_content in seen_contents:
                continue
            seen_contents.add(document.page_content)
            if (
                document.provider == "dify"
                and document.metadata is not None
                and document.metadata["doc_id"] not in doc_ids
            ):
                # weight rerank only support text documents
                if not document.metadata.get("doc_type") or document.metadata.get("doc_type") == DocType.TEXT:
                    doc_ids.add(document.metadata["doc_id"])
                    unique_documents.append(document)
            else:
                if document not in unique_documents:
                    unique_documents.append(document)

        documents = unique_documents

        query_scores = self._calculate_keyword_score(query, documents)
        query_vector_scores = self._calculate_cosine(self.tenant_id, query, documents, self.weights.vector_setting)
        business_priority_scores = self._calculate_business_priority_scores(query, documents)

        rerank_documents = []
        for document, query_score, query_vector_score, business_priority_score in zip(
            documents, query_scores, query_vector_scores, business_priority_scores
        ):
            score = (
                self.weights.vector_setting.vector_weight * query_vector_score
                + self.weights.keyword_setting.keyword_weight * query_score
                + business_priority_score
            )
            if score_threshold and score < score_threshold:
                continue
            if document.metadata is not None:
                document.metadata["score"] = score
                document.metadata["business_priority_score"] = business_priority_score
                rerank_documents.append(document)

        rerank_documents.sort(key=lambda x: x.metadata["score"] if x.metadata else 0, reverse=True)
        return rerank_documents[:top_n] if top_n else rerank_documents

    def _calculate_business_priority_scores(self, query: str, documents: list[Document]) -> list[float]:
        """
        Inject business-aware priority before final rerank ordering.

        Current focus:
        - Prefer price/policy chunks for the same product entity as the query
        - Avoid boosting sibling models such as "Q10L Pro" for a "Q10L" query
        """
        if not query or not documents:
            return [0.0 for _ in documents]

        try:
            query_extraction = FilterRuleLoader.get_applicable_rules(query)
        except Exception:
            return [0.0 for _ in documents]

        if not query_extraction.base_entity:
            return [0.0 for _ in documents]

        scores = []
        for document in documents:
            content = document.page_content or ""
            if not content:
                scores.append(0.0)
                continue

            price_signal_count = self._count_price_signals(content)
            if price_signal_count == 0:
                scores.append(0.0)
                continue

            try:
                doc_extraction = FilterRuleLoader.extract_structured_entity(content)
            except Exception:
                scores.append(0.0)
                continue

            if not doc_extraction.base_entity:
                scores.append(0.0)
                continue

            if not query_extraction.matches(doc_extraction):
                scores.append(0.0)
                continue

            # Exact same-entity price chunks receive the strongest bump.
            # A single weak "价格" mention should not dominate, but structured
            # price cards with multiple business fields should.
            if price_signal_count >= 3:
                scores.append(0.2)
            elif price_signal_count >= 2:
                scores.append(0.15)
            else:
                scores.append(0.08)

        return scores

    def _count_price_signals(self, content: str) -> int:
        content_lower = content.lower()
        return sum(1 for keyword in self.PRICE_SIGNAL_KEYWORDS if keyword.lower() in content_lower)

    def _calculate_keyword_score(self, query: str, documents: list[Document]) -> list[float]:
        """
        Calculate BM25 scores
        :param query: search query
        :param documents: documents for reranking

        :return:
        """
        keyword_table_handler = JiebaKeywordTableHandler()
        query_keywords = keyword_table_handler.extract_keywords(query, None)
        documents_keywords = []
        for document in documents:
            # get the document keywords
            document_keywords = keyword_table_handler.extract_keywords(document.page_content, None)
            if document.metadata is not None:
                document.metadata["keywords"] = document_keywords
                documents_keywords.append(document_keywords)

        # Counter query keywords(TF)
        query_keyword_counts = Counter(query_keywords)

        # total documents
        total_documents = len(documents)

        # calculate all documents' keywords IDF
        all_keywords = set()
        for document_keywords in documents_keywords:
            all_keywords.update(document_keywords)

        keyword_idf = {}
        for keyword in all_keywords:
            # calculate include query keywords' documents
            doc_count_containing_keyword = sum(1 for doc_keywords in documents_keywords if keyword in doc_keywords)
            # IDF
            keyword_idf[keyword] = math.log((1 + total_documents) / (1 + doc_count_containing_keyword)) + 1

        query_tfidf = {}

        for keyword, count in query_keyword_counts.items():
            tf = count
            idf = keyword_idf.get(keyword, 0)
            query_tfidf[keyword] = tf * idf

        # calculate all documents' TF-IDF
        documents_tfidf = []
        for document_keywords in documents_keywords:
            document_keyword_counts = Counter(document_keywords)
            document_tfidf = {}
            for keyword, count in document_keyword_counts.items():
                tf = count
                idf = keyword_idf.get(keyword, 0)
                document_tfidf[keyword] = tf * idf
            documents_tfidf.append(document_tfidf)

        def cosine_similarity(vec1, vec2):
            intersection = set(vec1.keys()) & set(vec2.keys())
            numerator = sum(vec1[x] * vec2[x] for x in intersection)

            sum1 = sum(vec1[x] ** 2 for x in vec1)
            sum2 = sum(vec2[x] ** 2 for x in vec2)
            denominator = math.sqrt(sum1) * math.sqrt(sum2)

            if not denominator:
                return 0.0
            else:
                return float(numerator) / denominator

        similarities = []
        for document_tfidf in documents_tfidf:
            similarity = cosine_similarity(query_tfidf, document_tfidf)
            similarities.append(similarity)

        # for idx, similarity in enumerate(similarities):
        #     print(f"Document {idx + 1} similarity: {similarity}")

        return similarities

    def _calculate_cosine(
        self, tenant_id: str, query: str, documents: list[Document], vector_setting: VectorSetting
    ) -> list[float]:
        """
        Calculate Cosine scores
        :param query: search query
        :param documents: documents for reranking

        :return:
        """
        query_vector_scores = []

        model_manager = ModelManager()

        embedding_model = model_manager.get_model_instance(
            tenant_id=tenant_id,
            provider=vector_setting.embedding_provider_name,
            model_type=ModelType.TEXT_EMBEDDING,
            model=vector_setting.embedding_model_name,
        )
        cache_embedding = CacheEmbedding(embedding_model)
        query_vector = cache_embedding.embed_query(query)
        for document in documents:
            # calculate cosine similarity
            if document.metadata and "score" in document.metadata:
                query_vector_scores.append(document.metadata["score"])
            else:
                # transform to NumPy
                vec1 = np.array(query_vector)
                vec2 = np.array(document.vector)

                # calculate dot product
                dot_product = np.dot(vec1, vec2)

                # calculate norm
                norm_vec1 = np.linalg.norm(vec1)
                norm_vec2 = np.linalg.norm(vec2)

                # calculate cosine similarity
                cosine_sim = dot_product / (norm_vec1 * norm_vec2)
                query_vector_scores.append(cosine_sim)

        return query_vector_scores
