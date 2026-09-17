# The Agent speaks only scene-level and object-level verbs

The Agent's entire surface is a small set of named, high-leverage Verbs. Vertex-level work, shader graphs, topology, UVs, and rigs are forbidden in that vocabulary even if the Engine uses them internally. The constraint is load-bearing: a small verb set is what makes a weaker model produce better work than a strong model crawling a human DCC, and what makes the watching loop fast enough to be the product. If any of those leak into the Agent's vocabulary, Tessera is driving Blender with extra steps.
