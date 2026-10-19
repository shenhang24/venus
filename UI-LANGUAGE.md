# Interface and source languages

The interface supports Chinese and English. Windows display-language override,
then the Windows user UI language API, supplies the preference. If unavailable,
browser language supplies the preference. Unsupported preferences fall back to
English. Browser language and Windows display language can differ.

Interface translation operates on program-owned literals before private values
are inserted. Original Markdown, file names, quotations, source titles and saved
analysis are preserved. The page title remains the product name for single-window
recognition.

New analysis follows the source language. Mixed-language sources retain their
terminology; analysis uses the dominant language. Existing analysis is not
retroactively translated.

Implementation default for skills combining sources: retain existing skill text
and use its dominant language for new additions; new skills follow the current
source. Set VENUS_SKILL_LANGUAGE_POLICY=source-first before launching to use the
current source language for additions instead. Neither policy rewrites originals,
previous analysis or exact quotations. Fixed internal enums remain unchanged.
