import re

from rank_bm25 import BM25Okapi
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.models import SourceChunk


def chunk_text(text: str, target_words: int = 90) -> list[SourceChunk]:
    text = text.strip()
    if not text:
        return []

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        paragraphs = [text]

    chunks: list[SourceChunk] = []
    buffer: list[str] = []
    word_count = 0

    def flush():
        nonlocal buffer, word_count
        if buffer:
            chunks.append(
                SourceChunk(
                    chunk_id=f"c{len(chunks)}",
                    text=" ".join(buffer).strip(),
                    position=len(chunks),
                )
            )
            buffer = []
            word_count = 0

    for para in paragraphs:
        words = para.split()
        if word_count + len(words) > target_words and buffer:
            flush()
        buffer.append(para)
        word_count += len(words)

    flush()
    return chunks


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


class HybridRetriever:
    """BM25 + TF-IDF cosine similarity fused with reciprocal rank fusion.

    Same pattern used in the resume-screening retriever: neither signal alone
    is reliable on short, jargon-heavy chunks, so we rank with both and merge
    the rankings rather than the raw scores.
    """

    def __init__(self, chunks: list[SourceChunk]):
        self.chunks = chunks
        self._tokenized = [_tokenize(c.text) for c in chunks]
        self._bm25 = BM25Okapi(self._tokenized) if chunks else None
        self._tfidf = TfidfVectorizer(stop_words="english") if chunks else None
        self._tfidf_matrix = (
            self._tfidf.fit_transform([c.text for c in chunks]) if chunks else None
        )

    def search(self, query: str, top_k: int = 4, rrf_k: int = 60) -> list[tuple[SourceChunk, float]]:
        if not self.chunks:
            return []

        bm25_scores = self._bm25.get_scores(_tokenize(query))
        bm25_ranked = sorted(range(len(self.chunks)), key=lambda i: -bm25_scores[i])

        query_vec = self._tfidf.transform([query])
        tfidf_scores = cosine_similarity(query_vec, self._tfidf_matrix)[0]
        tfidf_ranked = sorted(range(len(self.chunks)), key=lambda i: -tfidf_scores[i])

        rrf_scores: dict[int, float] = {}
        for rank, idx in enumerate(bm25_ranked):
            rrf_scores[idx] = rrf_scores.get(idx, 0.0) + 1.0 / (rrf_k + rank + 1)
        for rank, idx in enumerate(tfidf_ranked):
            rrf_scores[idx] = rrf_scores.get(idx, 0.0) + 1.0 / (rrf_k + rank + 1)

        ranked = sorted(rrf_scores.items(), key=lambda x: -x[1])[:top_k]
        max_score = ranked[0][1] if ranked else 1.0
        return [(self.chunks[i], score / max_score) for i, score in ranked]
