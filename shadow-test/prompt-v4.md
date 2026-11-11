Write a single self-contained HTML file that uses Three.js 0.170, imported with
an importmap: "three" from https://unpkg.com/three@0.170.0/build/three.module.js
and "three/addons/" from https://unpkg.com/three@0.170.0/examples/jsm/.
No other libraries or assets.

The scene: a shadow sculpture, like the cover of "Gödel, Escher, Bach". A room
corner (a floor, a left wall and a right wall) and a carved sculpture hanging
on thin wires, lit by three lights. Its shadow on the floor reads HAPPY, on the
left wall AGENT, and on the right wall CODER.

PART 1. Hard rules. These always win over style.
- All three words read left to right, not mirrored, as seen by the camera,
  and all three are readable in the same frame.
- The letters come only from real shadows cast by the sculpture. Surfaces may
  have materials and texture, but nothing drawn, painted or projected that
  forms or hints at the letters.
- The sculpture may be several pieces, but each one hangs freely. Nothing
  touches the walls or the floor.
- The pieces are smooth carved solids with softened edges, not visible cubes
  or voxels. Seen from the camera, they should not plainly spell the words.
- The wall shadows must not be hidden behind the pieces.
- Render at 1600x900. Loop of 10 seconds: the pieces twist on their wires and
  the shadows scramble, then they settle and all three words stay readable for
  about 4 seconds.
- Overlay text: top left "Shadow test: HAPPY / AGENT / CODER",
  bottom right "happy.engineering".
- With ?explore in the URL, add orbit controls and buttons to view the scene
  from each light's position, so people can see how it works. Overlay text and
  controls must never cover any of the three words.

PART 2. Art direction. Open; this is where your taste shows.
Make it look like a frame from a AAA game or an award-winning design photo,
something people stop scrolling for. Material, room, lighting, camera, color
and any post-processing are your choice.

Output only the HTML.
