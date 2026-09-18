# The Person picks a Brain from what the Provider currently offers

v1 the short list of Providers is Anthropic, OpenAI, Google, OpenRouter, and Nous. A Provider is the paid API the Key belongs to, lab or gateway. Tessera does not pin Brains: it lists what that Provider currently offers (chat, text in and out), picks the cheapest image-capable Brain as default, and remembers Key and Brain per Provider. A picture sent to a Brain that cannot see it is an error the Person can act on. Verbs and the system prompt do not change when Provider or Brain does.

This supersedes the SKU-pinning reading of ADR-0016. The short list, the rejection of one lab, the rejection of local models, and the shared Verb contract still stand. A generic OpenAI-compatible URL was rejected: that is the any-model door by another name.
