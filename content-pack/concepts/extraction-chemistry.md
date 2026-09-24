---
id: extraction-chemistry
title: Extraction chemistry
one_liner: "A tea, a tincture and an essential oil are three extractions of the same leaf; polarity, volatility and heat decide which molecules each one contains."
why_here: "Tea Time describes every preparation as chemistry - a solvent, a temperature and a time - rather than as a recipe. This 101 gives the three rules that make those pages readable, and the chamomile story in which heat makes a molecule the plant never did."
prerequisites: [measurement-basis]
terms: [infusion, decoction, tincture, steam-distillation, polarity, solubility, volatility, extraction-yield, hydroethanolic, herb-to-extract-ratio, glycoside, proazulene, azulene, artefact, pseudo-first-order]
figures: [fig-extraction]
further_reading:
  - { title: "EMA/HMPC. Assessment report on Matricaria recutita L., flos and aetheroleum (2015)", url: "https://www.ema.europa.eu/en/documents/herbal-report/final-assessment-report-matricaria-recutita-l-flos-and-matricaria-recutita-l-aetheroleum-first-version_en.pdf-0", kind: review }
  - { title: "Walch SG et al. Determination of the biologically active flavour substances thujone and camphor in foods and medicines containing sage. Chem Cent J 2011", url: "https://doi.org/10.1186/1752-153X-5-44", kind: paper }
  - { title: "Harbourne N et al. Optimisation of the extraction and processing conditions of chamomile (Matricaria chamomilla L.) for incorporation into a beverage. Food Chem 2009", url: "https://doi.org/10.1016/j.foodchem.2008.11.044", kind: paper }
self_check:
  - q: "Hot water extracted about 93 % of lemon balm's polyphenols but only 31 % of its oil. Which two properties explain the gap?"
    options: ["Colour and taste", "Polarity (phenolics dissolve in water) and volatility (oil molecules are poorly soluble and escape)", "Leaf size and age", "Price and availability"]
    answer: 1
    explanation: "Polar phenolic acids and glycosides dissolve readily in hot water; non-polar, volatile terpenes dissolve poorly and some of what dissolves evaporates [131]."
  - q: "Chamomile essential oil is blue from chamazulene. Is chamazulene in chamomile tea?"
    options: ["Yes, at the same level as in the oil", "No, never", "Not established by the sources read: chamazulene forms from matricin during steam distillation, and matricin itself reaches the tea", "Only in cold tea"]
    answer: 2
    explanation: "The EMA describes conversion during steam distillation and extraction of matricin into teas; presence or absence of chamazulene in a cup is not claimed [10]."
  - q: "Which solvent recovered the most carnosic acid from dried rosemary in one study?"
    options: ["Water", "Ethanol", "n-Hexane", "Vinegar"]
    answer: 2
    explanation: "Carnosic acid is less polar than rosmarinic acid; hexane reached 13 % of the dried extract while ethanol favoured rosmarinic acid [136]."
---

## What it is

<!-- framing -->
Every preparation on Tea Time is an extraction: a solvent applied to plant tissue at some temperature for some time. Three properties of each molecule decide how much of it ends up in the liquid.

Polarity comes first. Water dissolves polar molecules such as phenolic acids and flavonoid glycosides, and dissolves the small, non-polar terpenes of the oil poorly; menthol is almost insoluble in water [130]. That is why a hot-water infusion of peppermint takes up about 75 % of the leaf's polyphenols but only 20-25 % of its oil after 10 minutes with boiling water [6], and why a lemon balm tea took up 93 % of the polyphenols and 31 % of the oil [131]. Adding ethanol shifts the balance towards less polar compounds. Sage leaf gave 3,634 mg rosmarinic acid per 100 g dry matter in 30 % ethanol against 2,154 mg in water under the same conditions [132]; thyme phenolics were extracted best by 60 % ethanol [9]; and carnosic acid, less polar again, reached 13 % of a dried rosemary extract only with hexane [136].

Volatility comes second. Oil molecules that do dissolve can escape into the air, and the terpenes found in a peppermint tea were a narrower set than the oil's, 14 compounds against 70 [129]. Heat and time come third. Chamomile phenolics were extracted faster as water temperature rose from 57 to 100 °C [133], while thujone and camphor in sage tea rose for about five minutes and then levelled off, with a water infusion recovering on average 30 % of the thujone released by 60 % ethanol [127].

## The key idea in one picture

Figure 2 is the picture. For each herb with both measurements, the phenolic bar stands far above the oil bar [6,131]. Imagine a horizontal line from very polar (sugars, glycosides) on the left to non-polar (terpenes, carnosic acid) on the right, and place water, 30-60 % ethanol and hexane along it: each solvent reaches its own stretch of the line [9,132,136].

## The maths, gently

Extraction yield is a ratio, and it needs a stated denominator:

$$ Y = \frac{m_{\text{in preparation}}}{m_{\text{reference}}} $$

- $m_{\text{in preparation}}$ is the amount of the compound or fraction found in the tea or tincture.
- $m_{\text{reference}}$ is either the plant's content (lemon balm, peppermint) or the amount a stronger extract released (sage). Figure 2 keeps the two kinds apart.

When extraction follows pseudo-first-order kinetics, as chamomile phenolics did [133], the amount extracted approaches a ceiling exponentially:

$$ C(t) = C_{\infty}\left(1 - e^{-kt}\right) $$

- $C(t)$ is the concentration in the liquid at time $t$; $C_{\infty}$ the level it approaches; $k$ a rate constant that rises with temperature.

## How this paper uses it

Heat can also make molecules. Chamomile flowers contain matricin, a colourless proazulene, and during steam distillation it is at least partly converted into azulenes such as chamazulene, which is why the pharmacopoeia describes the oil as blue [10]. The same EMA report says matricin itself is extracted into teas at pharmaceutically relevant levels [10]. No source read establishes whether chamazulene forms in a cup, so the chamomile page claims neither its presence nor its absence. Drying is a chemical step in the same sense: carnosol in rosemary and sage is an oxidative artefact of carnosic acid formed after harvest [43], and oven-drying chamomile at 80 °C lowered its phenolics [133]. What else is in the cup matters too: thyme infusions mixed with saponin-rich roots held less thymol and fewer volatiles as the share of those roots rose [138]. Tinctures differ by starting material as well as solvent: commercial lemon balm tinctures from dried herb held 2.96-22.18 mg/mL rosmarinic acid against no more than 0.92 mg/mL from fresh herb [135].

<!-- synthesis -->
Taken together, a tea is best read as a phenolic-glycoside extract with a minor, partly lost terpene fraction; a tincture as a broader extract whose reach depends on its alcohol strength and starting material; and an essential oil as a distillation product that can contain molecules the plant never made [6,10,127,131,132,136].
