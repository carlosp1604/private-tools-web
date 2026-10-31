import { copyFileSync } from 'node:fs'

// Workers assets cannot rewrite to a file with brackets in its name without losing the secret id
copyFileSync('out/s/[id].html', 'out/s/view.html')
