# Tessera is the engine; Blender never appears

Agents already drive Blender, so a chat overlay on Blender is not a product. Tessera owns the scene, the operations, and the vocabulary: it *is* the 3D software, designed so an agent can do stunning work with a small set of operations, few tokens, and weaker models. Wrapping Blender (or any other human DCC) was rejected because those surfaces were built for humans and force the agent to spend tokens on *how* instead of *what*. An adapter-now / own-engine-later path was rejected because the adapter's limitations would leak into the verb set and become the product.

This does **not** mean reimplementing Blender's mesh modeller. The Engine's geometric substrate is a later decision; the decision here is only that Tessera is not a layer on someone else's DCC.
