import { copyFileSync } from 'node:fs'

// Workers assets cannot rewrite to a file with brackets in its name without losing the id in the path
copyFileSync('out/s/[id].html', 'out/s/view.html')
copyFileSync('out/f/[code].html', 'out/f/view.html')
