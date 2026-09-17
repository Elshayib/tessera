# The Engine stores Clay, not a Mesh

Compose and Sculpt have to be cheap, exact, and speakable as Verbs. The Engine therefore holds form as Clay (signed distance fields). The Viewport can show Clay directly. A Mesh is poured from Clay later, when Game-ready export becomes real.

Storing triangle meshes from day one was rejected: mesh booleans are fragile, and intent-level Sculpt on a mesh slides into Vertex-level work, which is forbidden. Voxels were rejected as Clay with a worse ceiling (blocky at low resolution, huge at high).

This is the long-run call. Game engines will still want a Mesh. That is an extraction Verb on Clay, not a reason to *be* a mesh modeller.
