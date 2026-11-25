# ATSified - free ATS resume analyzer

Upload a resume -> ATS score out of 10 -> missing skills -> free courses -> week-by-week roadmap.

## Run on your computer (VS Code)
1. Install Node.js (LTS) from https://nodejs.org
2. VS Code: File > Open Folder > select this `atsified` folder
3. Terminal > New Terminal, then run:
       npm install
       npm start
4. Open http://localhost:3000

## Deploy free on Vercel
1. Push this folder to a new GitHub repo (node_modules is ignored by .gitignore)
2. vercel.com > Add New > Project > import the repo > Deploy (no settings needed)

## Folder map
- public/   website (index.html, style.css, app.js)
- api/      serverless functions: analyze.js (main), roles.js
- lib/engine.js   text extraction, TF-IDF + cosine similarity, scoring, courses, roadmap
- data/roles.json   23 job roles with weighted skills (edit or add roles here)
- data/courses.json curated free resources per skill (edit or add; verify links)
- server.js   local-only server (Vercel ignores it)

## Score (out of 10)
50% skills matched + 20% TF-IDF/cosine similarity with the job text + 30% ATS-friendly format checks.
