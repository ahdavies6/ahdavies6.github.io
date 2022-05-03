
I study [neural language models (LMs)](https://towardsdatascience.com/neural-language-models-32bec14d01dc), specifically *how they learn and represent the meaning in language*.
Deep neural networks in general, and neural LMs in particular, are usually seen as being "black boxes": we do not (fully) understand what goes on inside them, only how they learn and how well they perform on the benchmarks we create for them (e.g. [SuperGLUE](https://super.gluebenchmark.com/), [BIG-bench](https://github.com/google/BIG-bench), [LAMA](https://github.com/facebookresearch/LAMA), etc.).
These benchmarks can be valuable tools for evaluating progress in language modeling (and natural language processing more generally), but they are (usually) agnostic to *how*&nbsp; these models achieve the performance they do.
How can we tell *what they have actually learned*&nbsp; about language (and whether they reflect aspects of human language acquisition and processing)?
Do they ["understand" the meanings of words, phrases, and sentences](https://aclanthology.org/2020.acl-main.463.pdf)?
Or are they just impressive [parrots](https://dl.acm.org/doi/10.1145/3442188.3445922)?

Humans learn language through richly [multimodal, embodied interaction](https://doi.org/10.1016/j.cognition.2012.06.016) with the world and [other linguistic agents](https://doi.org/10.1111/j.1467-7687.2005.00445.x).
Is this simply a contingent feature of human language acquisition, or a fundamental requirement for fully understanding language?
<!-- What semantics can be learned by text-only language models? -->
Do [grounded language models](https://aclanthology.org/2020.emnlp-main.703.pdf) "know" something about language that [cannot be learned](https://aclanthology.org/2020.acl-main.463.pdf) [from text alone](https://arxiv.org/pdf/2008.01766.pdf)?

My goal is to develop research approaches that can help us answer questions like these.
In particular, I want to investigate whether there are elements of semantic representations learned by multimodal LMs (e.g. [CLIP](https://arxiv.org/pdf/2103.00020.pdf), [DALL-E](https://arxiv.org/pdf/2102.12092.pdf) ([2](https://arxiv.org/pdf/2204.06125.pdf)), [MERLOT](https://arxiv.org/pdf/2106.02636.pdf) ([Reserve](https://arxiv.org/pdf/2201.02639.pdf))) that are not acquired by text-only models.
Can we [locate](https://arxiv.org/pdf/2202.05262.pdf) semantic content acquired by grounded language models that is [inaccessible to text-only models](https://aclanthology.org/2020.acl-main.463.pdf)?

I am currently researching how [counterfactual methodologies](https://christophm.github.io/interpretable-ml-book/counterfactual.html#counterfactual) can be applied to analyze the representation and use of word meaning in text-only and multimodal neural LMs.
