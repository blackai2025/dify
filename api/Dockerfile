# base image
FROM python:3.12-slim-bookworm AS base

WORKDIR /app/api

# Install uv (use China mirror to speed up)
ENV UV_VERSION=0.8.9

RUN pip install -i https://pypi.tuna.tsinghua.edu.cn/simple/ --no-cache-dir uv==${UV_VERSION}


FROM base AS packages

# if you located in China, you can use aliyun mirror to speed up
RUN sed -i 's@deb.debian.org@mirrors.tuna.tsinghua.edu.cn@g' /etc/apt/sources.list.d/debian.sources

RUN apt-get update \
    && apt-get install -y --no-install-recommends --fix-missing \
          # basic environment
          g++ \
          # for building gmpy2
          libmpfr-dev libmpc-dev

# Install Python dependencies
COPY pyproject.toml uv.lock ./
# Use China PyPI mirror with extended timeout for slow networks
ENV UV_HTTP_TIMEOUT=300
RUN uv sync --frozen --no-dev --index-url https://pypi.tuna.tsinghua.edu.cn/simple/

# production stage
FROM base AS production

ENV FLASK_APP=app.py
ENV EDITION=SELF_HOSTED
ENV DEPLOY_ENV=PRODUCTION
ENV CONSOLE_API_URL=http://127.0.0.1:5001
ENV CONSOLE_WEB_URL=http://127.0.0.1:3000
ENV SERVICE_API_URL=http://127.0.0.1:5001
ENV APP_WEB_URL=http://127.0.0.1:3000

EXPOSE 5001

# set timezone
ENV TZ=UTC

# Set UTF-8 locale
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV PYTHONIOENCODING=utf-8

WORKDIR /app/api

# Create non-root user
ARG dify_uid=1001
RUN groupadd -r -g ${dify_uid} dify && \
    useradd -r -u ${dify_uid} -g ${dify_uid} -s /bin/bash dify && \
    chown -R dify:dify /app

RUN sed -i 's@deb.debian.org@mirrors.tuna.tsinghua.edu.cn@g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        curl nodejs \
        libgmp-dev libmpfr-dev libmpc-dev \
        expat libldap-2.5-0=2.5.13+dfsg-5 perl libsqlite3-0=3.40.1-2+deb12u2 zlib1g=1:1.2.13.dfsg-1 \
        media-types \
        libmagic1 \
    && for i in 1 2 3 4 5; do apt-get install -y --no-install-recommends --fix-missing fonts-noto-cjk && break || echo "Retry $i..."; sleep 5; done \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Copy Python environment and packages
ENV VIRTUAL_ENV=/app/api/.venv
COPY --from=packages --chown=dify:dify ${VIRTUAL_ENV} ${VIRTUAL_ENV}
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

# Download nltk data
RUN mkdir -p /usr/local/share/nltk_data && NLTK_DATA=/usr/local/share/nltk_data python -c "import nltk; nltk.download('punkt'); nltk.download('averaged_perceptron_tagger'); nltk.download('stopwords')" \
    && chmod -R 755 /usr/local/share/nltk_data

ENV TIKTOKEN_CACHE_DIR=/app/api/.tiktoken_cache

RUN python -c "import tiktoken; tiktoken.encoding_for_model('gpt2')" \
    && chown -R dify:dify ${TIKTOKEN_CACHE_DIR}

# Copy source code
COPY --chown=dify:dify . /app/api/

# Prepare entrypoint script
COPY --chown=dify:dify --chmod=755 docker/entrypoint.sh /entrypoint.sh


ARG COMMIT_SHA
ENV COMMIT_SHA=${COMMIT_SHA}
ENV NLTK_DATA=/usr/local/share/nltk_data

USER dify

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
