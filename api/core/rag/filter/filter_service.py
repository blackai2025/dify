"""
Filter Service

Applies post-retrieval filtering to documents based on entity exact matching.
Extracts entities from query and documents, keeps only exact matches.
"""

import logging

from core.rag.filter.filter_rule_loader import FilterRuleLoader
from core.rag.models.document import Document

logger = logging.getLogger("dify.rag.filter")


class FilterService:
    """Service for applying post-retrieval filtering"""

    @classmethod
    def apply_filter(cls, documents: list[Document], query: str) -> list[Document]:
        """
        Apply filtering rules to retrieved documents.

        Args:
            documents: List of retrieved documents
            query: Original user query

        Returns:
            Filtered list of documents
        """
        if not documents or not query:
            return documents

        # Extract structured entity from query
        query_extraction = FilterRuleLoader.get_applicable_rules(query)

        if not query_extraction.base_entity:
            # No entity found in query, return all documents
            return documents

        logger.info(
            "[FILTER_SERVICE] Filtering %d documents for entity: %s",
            len(documents),
            query_extraction.base_entity,
        )

        filtered_documents = []
        filtered_out_docs = []

        for doc in documents:
            # Get document title/name for logging
            doc_title = (
                doc.metadata.get("document_name")
                or doc.metadata.get("doc_name")
                or doc.metadata.get("title")
                or doc.metadata.get("source")
                or doc.metadata.get("file_name")
                or doc.metadata.get("name")
                or "Unknown"
            )

            # Check document content (not title, as user clarified)
            content = doc.page_content or ""
            metadata_content = doc.metadata.get("content", "")
            full_content = f"{content} {metadata_content}"

            should_filter, reason = FilterRuleLoader.should_filter_out(full_content, query_extraction)

            if should_filter:
                # Mark as filtered in metadata (for debugging)
                doc.metadata["filtered_out"] = True
                doc.metadata["filter_reason"] = reason
                filtered_out_docs.append({"title": doc_title, "reason": reason})
            else:
                filtered_documents.append(doc)

        logger.info(
            "[FILTER_SERVICE] Filtered: %d → %d documents (%d removed)",
            len(documents),
            len(filtered_documents),
            len(filtered_out_docs),
        )

        return filtered_documents

    @classmethod
    def apply_filter_with_stats(cls, documents: list[Document], query: str) -> tuple[list[Document], dict]:
        """
        Apply filtering with statistics.

        Args:
            documents: List of retrieved documents
            query: Original user query

        Returns:
            Tuple of (filtered_documents, stats_dict)
        """
        original_count = len(documents)
        filtered_docs = cls.apply_filter(documents, query)
        filtered_count = len(filtered_docs)

        stats = {
            "original_count": original_count,
            "filtered_count": filtered_count,
            "removed_count": original_count - filtered_count,
        }

        return filtered_docs, stats
