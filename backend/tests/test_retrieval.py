from app.retrieval import HybridRetriever, chunk_text

SAMPLE = """
The Great Barrier Reef is the world's largest coral reef system, stretching
over 2,300 kilometers off the coast of Queensland, Australia.

It is composed of over 2,900 individual reefs and 900 islands, and is the
only living structure visible from space.

Rising sea temperatures have caused repeated mass coral bleaching events,
with severe bleaching recorded in 2016, 2017, and 2020.
"""


def test_chunking_produces_nonempty_chunks():
    chunks = chunk_text(SAMPLE)
    assert len(chunks) >= 1
    assert all(c.text.strip() for c in chunks)


def test_chunk_ids_are_sequential():
    chunks = chunk_text(SAMPLE, target_words=15)
    assert [c.position for c in chunks] == list(range(len(chunks)))


def test_retriever_finds_relevant_chunk():
    chunks = chunk_text(SAMPLE, target_words=15)
    retriever = HybridRetriever(chunks)
    results = retriever.search("coral bleaching sea temperature", top_k=1)
    assert results
    top_chunk, score = results[0]
    assert "bleaching" in top_chunk.text.lower()
    assert score > 0


def test_retriever_handles_empty_chunks():
    retriever = HybridRetriever([])
    assert retriever.search("anything") == []
