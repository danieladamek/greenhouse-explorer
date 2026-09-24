---
id: measurement-basis
title: Measurement basis
one_liner: "An amount is always an amount per something - fresh leaf, dry leaf, the oil or an extract - and two values on different bases cannot be compared."
why_here: "The catalogue holds values per gram of dry leaf, per cent of essential oil, per litre of tea and per gram of extract, often for the same compound. The compare view refuses to put them on one axis, and this 101 explains why."
prerequisites: []
terms: [basis, fresh-weight, dry-weight, essential-oil-percent, per-g-extract, occurrence, ppm, gc-ms, hplc, essential-oil]
figures: [fig-extraction]
further_reading:
  - { title: "Carnat AP et al. The aromatic and polyphenolic composition of lemon balm (Melissa officinalis L. subsp. officinalis) tea. Pharm Acta Helv 1998", url: "https://doi.org/10.1016/S0031-6865(97)00026-5", kind: paper }
  - { title: "Kosakowska O et al. Morphological and chemical traits as quality determinants of common thyme. Agronomy 2020", url: "https://doi.org/10.3390/agronomy10060909", kind: paper }
  - { title: "Costine B et al. Exploring native Scutellaria species provides insight into differential accumulation of flavones. Sci Rep 2022", url: "https://doi.org/10.1038/s41598-022-17586-1", kind: paper }
self_check:
  - q: "Citral is 74 % of the essential oil in a lemon balm tea but 0.13 % of the dried leaf. Which statement is right?"
    options: ["The tea is richer in citral than the leaf", "The two numbers contradict each other", "They are on different bases (per cent of oil vs per cent of leaf) and describe different quantities", "One of them must be a typo"]
    answer: 2
    explanation: "74 % is a share of the oil fraction; 0.13 % is a share of the whole dry leaf. Both are true at once [131]."
  - q: "Why does the compare view refuse to plot thymol (% of oil) next to rosmarinic acid (mg per 100 g dry herb)?"
    options: ["Because thymol is more important", "Because the two values are per different things, so bar heights would mean nothing", "Because rosmarinic acid is not in thyme", "Because the values are unverified"]
    answer: 1
    explanation: "A bar chart implies one scale. Values per oil and per dry herb are not on one scale without the oil content of that sample."
---

## What it is

<!-- framing -->
A concentration has two parts: a number and what that number is per. The second part is the basis, and on this site it is never optional.

Four bases dominate the catalogue. Fresh weight is per gram of plant as harvested, water included. Dry weight is per gram of dried material, the usual basis for phenolics measured by HPLC. Per cent of essential oil is a share of the distilled oil, which is how GC-MS reports oil composition. Per gram of extract is relative to an extract after the solvent is removed. They can differ by orders of magnitude for the same compound in the same plant. In one thyme cultivar thymol made up 36.7-54.6 % of the oil [20]; the pharmacopoeia requires at least 1.2 % oil in thyme herb with at least 40 % thymol plus carvacrol [9], which means a thymol-rich oil can still be well under one per cent of the herb itself.

Lemon balm makes the point in one study. The dried leaf held 0.32 % essential oil and citral made up 0.13 % of the leaf, while in the tea citral was 74 % of a much smaller oil fraction of 10 mg/L [131]. Both statements are true, and they describe different things.

## The key idea in one picture

Draw a leaf as a box. Inside it, a small box labelled "oil, a few per cent at most"; inside that, a slice labelled "thymol, about half of the oil" [9,20]. Next to it, a second large box labelled "dry herb" with a band across it for "rosmarinic acid, per 100 g". Arrows from each inner box to separate axes make the rule visible: the two numbers live on different scales.

## The maths, gently

To move from one basis to another you need a conversion factor that belongs to the same sample:

$$ c_{\text{leaf}} = c_{\text{oil}} \times f_{\text{oil}} $$

- $c_{\text{oil}}$ is the compound's share of the oil (for example 0.40 for 40 %).
- $f_{\text{oil}}$ is the oil's share of the dry leaf (for example 0.012 for 1.2 %).
- $c_{\text{leaf}}$ is then the compound's share of the dry leaf.

With the pharmacopoeial minimums above the product is 0.0048, about 0.5 % of the herb [9]. That is the builder's arithmetic on stated minimums, not a measurement. The catalogue does not perform such conversions, because $f_{\text{oil}}$ and the water content needed for fresh-to-dry conversion are rarely reported for the sample that gave $c_{\text{oil}}$.

## How this paper uses it

Every occurrence row carries a basis, and the compare view will not plot values on different bases together. Skullcap shows why the discipline matters: one comparison reported baicalin at 11.7 mg/g in *S. lateriflora* leaf against 26.1 mg/g in *S. baicalensis* root [24], and the catalogue flags that the basis of the root value may be fresh rather than dry weight, which would make it the low end of a much wider range. Values from Dr. Duke's arrive in ppm, often without saying whether the denominator is leaf, plant or oil, and are labelled as such. Tea values are per litre of infusion: food-grade sage teas averaged 4.4 mg/L thujone [127], a number about a cup, not about a leaf.

Figure 2 on Tea Time keeps a second kind of denominator apart as well. Its peppermint, lemon balm and chamomile bars are shares of the plant's content [6,10,131]; its sage bars are shares of what an ethanol extract of the same material released [127,132].
