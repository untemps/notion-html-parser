import parse from '../src/notion-html-parser.js'
import { promises as fs } from 'node:fs'

const API_TOKEN = 'SET_YOUR_API_TOKEN_HERE'
const PAGE_ID = '9c58b175ee3d450d988edc9edc0866b1'

try {
    const head = '<link rel="stylesheet" href="styles.css">'
    const html = await parse(API_TOKEN, PAGE_ID, head)
    await fs.writeFile('./dev/index.html', html)
    console.log(html)
} catch(err) {
    console.error(err)
}