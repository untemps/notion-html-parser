import { promises as fs } from 'node:fs'
import { configDotenv } from 'dotenv'

import parse from '../src/index.js'

configDotenv()

const API_TOKEN = process.env.API_TOKEN
const PAGE_ID = process.env.PAGE_ID

try {
    const head = '<link rel="stylesheet" href="./styles.css">'
    const html = await parse(API_TOKEN, PAGE_ID, head)
    await fs.writeFile('./dev/index.html', html)
    console.log(html)
} catch(err) {
    console.error(err)
}