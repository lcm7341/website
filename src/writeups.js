// the text files on each project page, by slug
const writeups = {
  "echo-2-2": {
    how: [
      "Geometry Dash runs its physics in fixed steps, a few hundred per second, on a different clock from the one that draws the screen. Echo hooks that loop and writes down which buttons went down or up on each step. On playback it presses the same buttons on the same steps, and the level plays out the same way.",
      "I took control of anything that could drift. Echo replaces the game's math for how many steps to run each frame, so your frame rate can't change the physics. Screen shake and random triggers draw from Echo's own seeded random number generator and land the same on each playback.",
      "Backstep saves the full game state each step, so you can rewind one step at a time and re-record from there. Converters translate between Echo's format and seven other bots'. The menu runs on Dear ImGui inside the game, and Luau scripts can drive its themes.",
    ],
    hardest: [
      "I spent the longest on legacy physics. I wanted Echo 2.2 to play old 2.1 macros, which meant making Geometry Dash 2.2 move the player the way vanilla 2.1 did. 2.2 runs its physics in four smaller substeps per tick where 2.1 ran one, and dozens of small rules changed on the way: player collision, slopes, spider teleports, rotation, the ground, and how move triggers and easing advance. I rebuilt each of those for 2.1 mode, about 5,400 lines of it, on its own branch over two and a half weeks.",
      "I found every difference the same way: record a macro in 2.1, play it in 2.2 with legacy physics on, find the exact frame where it dies, and log both games until I found the cause. Tax Evasion died on the first frame. A Peaceful Death died at 4%. Each one turned out to be a different rule. On Mac I hit one more wall: the compiler there inlines some of the functions I hook, so my hooks never ran and I had to catch the work one call later.",
      "Accuracy in general ran a close second. I hit the strangest bug on a level with three objects stacked on one spot: Apple's and Android's sort functions break ties in different ways, so on Android a spider landed one block lower than on a Mac. I copied Apple's sort routine into Echo by hand and made Android use it.",
    ],
    fun: "I spent more time on Echo's look than on almost anything else: 18 themes, six of them animated, and later a scripting system so you can build your own.",
    learned: [
      "I learned a game's physics loop inside out, and what it takes to make it deterministic: fixed timesteps, seeded randomness, and platform quirks down to how qsort breaks ties.",
      "I reverse engineered the game on four platforms, patched ARM64 code by hand on Android and iOS, and shipped one C++ codebase to Windows, macOS, Android and iOS.",
      "Embedding Luau taught me to sandbox a scripting language inside a mod that runs in someone else's game.",
    ],
  },

  "echo-2-1": {
    how: [
      "Echo 2.1 is a Windows DLL for Geometry Dash 2.113, a version with no mod loader. The installer drops in a stand-in for XInput9_1_0.dll, a small Windows file the game loads at startup. The stand-in forwards calls to the real file, waits for the game to finish loading, and then loads the newest Echo DLL once.",
      "From there Echo hooks the game's functions with MinHook, including the clock functions the game reads, which is how speedhack and frame advance work. Echo stores inputs against physics steps, the same way Echo 2.2 does.",
    ],
    hardest: [
      "I struggled most to keep it accurate while I added features. Version 1.6 put years-old code next to a brand-new menu, and at one point the new build broke macros that old versions and Echo 2.2's 2.1 physics mode played fine. I tracked regressions like that down in a game with no mod loader and no official hooks.",
      "I also had to tame randomness. A level with random triggers used to break any macro you recorded on it, so Echo 2.1 now seeds its randomness the way Echo 2.2 does.",
    ],
    fun: "I got to bring a 2023 project back in 2026 and give it Echo 2.2's menu and themes, so the two bots feel like one tool.",
    learned: [
      "I learned the Windows DLL loading order well enough to slip a proxy DLL in front of the game.",
      "I hooked functions with MinHook and cross-compiled the whole thing for Windows from Linux with clang-cl.",
      "Working without a mod loader showed me how much one saves you, and that lesson pushed me to build Echo 2.2 on Geode.",
    ],
  },

  glint: {
    how: [
      "Glint maps each Geometry Dash version to a specific build of the game on Steam. When you install one, Glint runs DepotDownloader with your Steam login to fetch that build, and copies over any files your other instances already have. Each instance gets its own folder with its own saves, settings and mods.",
      "On Linux Glint runs games through Proton, and on macOS through Wine, which it sets up for you. For versions before 2.2 it installs its own loader, a stand-in for a system DLL like the one Echo 2.1 uses, so .dll mods load without Mega Hack. We built the interface on weft, the UI library I made alongside it with AI.",
    ],
    hardest: [
      "I fought old versions and mods the whole way. Steam's DRM wraps several old releases, and each version has its own rules for how Mega Hack and Echo load. My builds crashed on 2.113, opened Mega Hack for a single frame, or told me Mega Hack wasn't logged in, before I got each combination working.",
      "I also had to make it feel good. The first versions worked, but I didn't enjoy using them, so I redesigned the UI from scratch more than once.",
    ],
    fun: "I loved designing Glint's look: the cardboard-box icon, the gold wordmark, the website, and the feel of clicking around the launcher.",
    learned: [
      "I learned how Steam stores and serves old builds, and drove DepotDownloader from inside an app.",
      "We shipped a desktop app to three operating systems, with Wine and Proton setup, self-updates, and a macOS app that moves itself into Applications.",
      "I found weft's gaps fast once I built a real app on it.",
    ],
  },

  "impossible-levels-list": {
    how: [
      "The website runs on a .NET API and PostgreSQL, with a Nuxt (Vue) frontend. Players vote on head-to-head matchups (\"this level is harder than that one\"), and a rating algorithm turns those votes into the order of the list. A level's rank sets its points on an exponential curve, from about 2,500 at #1 down to 10.",
      "Recalculating ratings took the most time, so I moved that math into a native C++ library that the .NET API calls through P/Invoke, keeping the old C# code as a fallback. ILLBot (Node and discord.js) runs community votes, a level guesser game and moderation, and talks to the site's API. ILL Browser, a Geode mod, reads the same API and shows the list in-game.",
    ],
    hardest: "We fight hardest with the ranking. We have to turn thousands of opinions about impossible levels into one order people trust. An older approach, Bradley-Terry, got the order wrong often and shuffled levels so much that two people checking a few days apart could argue over whether a level sat in the top 500 or the top 600. People still argue most about the middle of the list.",
    fun: "I had the most fun on ILL Browser, a full browser for the list in Geometry Dash's own style, so you can look through levels, records and leaderboards without leaving the game.",
    learned: [
      "I called native C++ from C# with P/Invoke, and sped up a slow algorithm without changing a single result.",
      "I learned to work in a codebase other people own, and to keep a Discord bot running for a real community.",
    ],
  },

  weft: {
    how: [
      "weft comes in layers. The core crate has zero dependencies and holds math, geometry, colors and input events. The graphics crate records drawing commands into a display list, and a CPU renderer turns that list into pixels: paths, strokes, gradients, shadows and images, blended in premultiplied color.",
      "The text crate parses OpenType fonts, rasterizes and caches glyphs, and shapes text with the GSUB and GPOS tables that handle ligatures and kerning. It handles right-to-left text and line breaking too. The UI crate is immediate-mode: your code describes the interface each frame, and weft remembers hover, focus, animations and last frame's layout so it can tell you what you clicked.",
      "C bindings let you call weft from C or C++, and golden-image tests compare rendered output against reference PNGs.",
    ],
    hardest: "Text took the longest. Fonts, shaping, right-to-left scripts and line breaking make up a field of their own, and I spent hours chasing pixel-level misalignments, like labels sitting a pixel off from the profile pictures beside them.",
    fun: "I wanted to see how far AI could take a project this big. My goal for weft is a UI library you'd pick on any platform, easy for a beginner and strong enough for a real app. I also had fun naming it: weft stands for \"What Everyone Finally Tries\".",
    learned: [
      "I got to see 2D rendering under the libraries everyone else uses: rasterizing paths, antialiasing and blending.",
      "I learned text rendering end to end, from parsing font files to shaping and right-to-left layout.",
      "AI agents can carry a large codebase a long way if you steer them, and keeping their work organized takes real planning and review.",
    ],
  },

  dosely: {
    how: [
      "Dosely is a React single-page app talking to an Express API, with PostgreSQL storing the data. Patients and prescribers sign up as separate account types and land on separate dashboards.",
      "A prescriber adds medications through a form that searches openFDA's drug label database as they type. Each prescription records dose, frequency and supply. Each time a patient logs a dose, Dosely counts the supply down and reads the frequency (daily, every few hours, or as needed) to work out when the next dose is due. A scheduled job sends reminder emails through Mailjet each morning.",
    ],
    hardest: "We spent the most care on security. Dosely handles health information even as a prototype, so we added password hashing, rate limits, security headers and CORS rules, and wrote security and deployment docs.",
    fun: "Building both sides with Alex and watching them connect: a prescriber adds a medication, and it appears on the patient's dashboard, ready to log.",
    learned: [
      "We designed one app for two kinds of users with different permissions.",
      "I worked with a public API (openFDA), scheduled jobs and transactional email for the first time.",
      "We deployed the full stack with Docker behind HTTPS.",
    ],
  },

  texlang: {
    how: [
      "You write math in a LaTeX document with TeXLang's package, and the command-line tool runs it before LaTeX builds the document. A lexer splits the source into tokens, a parser builds a syntax tree, and an interpreter evaluates it.",
      "The computer algebra system manipulates expressions as symbols: derivatives with rules like the one for u raised to the power v, integrals by substitution, by parts and partial fractions, plus limits, series, differential equations and linear algebra. TeXLang writes the results back into your document as typeset math.",
    ],
    hardest: "Integration took the most work. Derivatives follow clear rules, but for an integral the program has to pick a technique, try it, and simplify the answer into something you'd write by hand.",
    fun: "I fed in a whole calculus problem set and got each answer back typeset, from limits and integrals through a proof and a Calculus 3 section.",
    learned: [
      "I built a language end to end: lexer, parser and interpreter.",
      "Writing the algebra system taught me to represent and simplify math as symbols.",
    ],
  },

  "imgui-to-img": {
    how: [
      "imgui-to-img compiles Echo's real menu code as-is and replaces everything around it, Geode and the game, with small stand-ins. It runs the startup code the game would run and drives Dear ImGui frame by frame on an offscreen OpenGL surface, with no window open.",
      "Once the menu settles, it saves the pixels as a PNG, or saves each frame into a GIF of the menu opening. It applies themes, including downloaded theme files and Lua theme scripts, through the same functions Echo calls in the game.",
    ],
    hardest: "I wanted a render you couldn't tell apart from a real screenshot, so each stand-in for textures, fonts, settings and the logo had to match the real thing.",
    fun: "The first render outside the game matched Geometry Dash pixel for pixel.",
    learned: [
      "I learned to run code built for one host somewhere else by shimming what it depends on.",
      "I set up headless OpenGL rendering with EGL.",
    ],
  },

  "cryptography-workshop": {
    how: "It's one menu-driven C program. Each cipher has its own file, and a comment at the top of each file explains the math and what the cipher keeps (case, spaces and so on). I built AES-128 in CBC mode and SHA-256 from their specifications, and a self-test mode checks them against published test vectors.",
    hardest: "AES and SHA-256 took the most care. A small mistake in either one produces wrong output without crashing, so I caught mistakes by matching the official test vectors byte for byte.",
    fun: "I liked writing the Caesar cracker. It scores each possible shift on how English the result looks and hands you the winner.",
    learned: [
      "I traced ciphers from hand-breakable puzzles to modern block ciphers, and saw why the one-time pad is the one cipher you can prove unbreakable.",
      "I implemented a spec to the letter and tested against known answers.",
    ],
  },

  wordlebot: {
    how: "WordleBot scores the words in its list and suggests the best opener. After each guess you type in the colors Wordle gave you, gray, yellow or green, and it drops the words that no longer fit. Then it compares the letters the remaining words share and picks the guess that narrows the field most.",
    hardest: "I had to pick the most useful guess. A word that could be the answer can rule out fewer words than one that can't.",
    fun: "I played along with it: after RAISE and PLUMB, it named GHOST with 96% confidence and one word left.",
    learned: "WordleBot was one of my first Rust projects, so I learned ownership, collections and how to build a small command-line tool.",
  },
};

export default writeups;
