# Test fixtures

- `sample.heic` (640 × 480, red top-left quadrant, yellow ellipse on blue) and `portrait.heic` (480 × 640) were generated for this project with Pillow and pillow-heif (`img.save(path, format="HEIF", quality=90)`). They contain no third-party imagery.
# PDF fixture

`password-protected.pdf` is a generated blank 100 × 100 point page encrypted with pypdf 6.21.1 and the test password `test-only`. It contains no third-party content. It checks that the local PDF reader rejects encrypted documents before attempting text extraction; Python is not needed to run the browser test.

`speaker-vector.bin` is the unchanged 2,048-byte SLT example vector, row 7306 (`cmu_us_slt_arctic-wav-arctic_a0508`) of `Matthijs/cmu-arctic-xvectors`, revision `5c1297a9eb6c91714ea77c0d4ac5aca9b6a952e5` (MIT dataset declaration). SHA-256 `7384027325428d6eda21f47213572541443f5864044295a2e5c07fbaaf372bb3` matches the pre-existing Transformers.js documentation binary exactly. The original CMU copyright and permissive commercial-use terms are retained in `tools/local-ai/CMU-ARCTIC-COPYING.txt`, and the unmodified derived-dataset license/provenance card in `tools/local-ai/CMU-XVECTOR-README.md`. This test fixture is not a new production voice or a bundled model download.
