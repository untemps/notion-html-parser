import { Client } from '@notionhq/client'

const TAGS = {
    heading_1: 'h2',
    heading_2: 'h3',
    heading_3: 'h4',
    paragraph: 'p',
}

export default async (apiToken, pageId, head = '') => {
    const notion = new Client({
        auth: apiToken,
    })

    const getPage = async (id) => {
        return notion.pages.retrieve({
            page_id: id,
        })
    }

    const getBlock = async (id) => {
        return notion.blocks.children.list({
            block_id: id,
            page_size: 50,
        })
    }

    const parseBlock = async (block) => {
        let result = ''
        switch (block.type) {
            case 'text':
                result = parseRichText(block)
                break
            case 'heading_1':
            case 'heading_2':
            case 'heading_3':
            case 'paragraph':
                result = wrapRichTexts(
                    block[block.type].rich_text,
                    TAGS[block.type]
                )
                break
            case 'table':
                result = await parseTable(block.id, block.table)
                break
            case 'code':
                result = parseCode(block.code)
                break
            case 'equation':
                result = parseEquation(block.equation)
                break
            case 'divider':
                result = parseDivider(block.divider)
                break
            case 'bulleted_list_item':
                result = parseBullettedList(block.bulleted_list_item)
                break
            case 'numbered_list_item':
                result = parseNumberedList(block.numbered_list_item)
                break
            case 'to_do':
                result = parseTodoList(block.to_do)
                break
            case 'callout':
                result = parseCallout(block.callout)
                break
            case 'image':
                result = parseImage(block.image)
                break
            case 'video':
                result = parseVideo(block.video)
                break
            case 'quote':
                result = parseQuote(block.quote)
                break
            case 'toggle':
                result = await parseToggle(block.id, block.toggle)
                break
            case 'file':
                result = parseFile(block.file)
                break
            case 'column_list':
                result = await parseColumnList(block.id)
                break
            case 'child_page':
                result = await parseChildPage(block.id, block.child_page)
                break
            default:
                console.log('Non managed block:', block)
                result = ''
        }
        return result
    }

    const parseChildPage = (childPageId, { title }) => {
        return `<a href="/?id=${childPageId}">${title}</a>`
    }

    const parseColumnList = async (blockId) => {
        const { results: blocks } = await getBlock(blockId)
        const rows = []
        await Promise.all(
            blocks.map(async (block, i) => {
                const { results: columns } = await getBlock(block.id)
                return await Promise.all(
                    columns.map(async (column, j) => {
                        const result = await parseBlock(column)
                        rows[j] = rows[j] || []
                        rows[j][i] = result
                        return result
                    })
                )
            })
        )
        return `<table>${rows
            .map(
                (row) =>
                    `<tr>${row.map((col) => `<td>${col}</td>`).join('')}</tr>`
            )
            .join('')}</table>`
    }

    const parseFile = ({ file: { url }, caption }) => {
        const figcaption = !!caption ? parseRichTexts(caption) : undefined
        const fileName = /([^\/]*)\?/.exec(url)?.[1]
        return `<figure><p class="file__link-file"><a href="${url}">${fileName}</a></p><p class="file__input-file"><input type="file"/></p>${
            figcaption ? `<figcaption>${figcaption}</figcaption>` : ''
        }</figure>`
    }

    const parseToggle = async (blockId, { rich_text }) => {
        const title = rich_text.reduce(
            (acc, richText) => `${acc}${parseRichText(richText)}`,
            ''
        )
        const { results } = await getBlock(blockId)
        const contents = results.reduce((acc, result) => {
            return result.paragraph.rich_text.reduce(
                (acc2, richText) =>
                    `${acc2}${
                        !richText.annotations.code ? '<p>' : ''
                    }${parseRichText(richText)}${
                        !richText.annotations.code ? '</p>' : ''
                    }`,
                acc
            )
        }, '')
        return `<article class="accordion"><button class="accordion__heading">${title}</button><div class="accordion__panel">${contents}</div></article>`
    }

    const parseQuote = ({ rich_text }) => {
        const content = rich_text.reduce(
            (acc, richText) => `${acc}${parseRichText(richText)}`,
            ''
        )
        return `<blockquote>${content}</blockquote>`
    }

    const parseImage = ({ external: { url } }) => {
        return `<img src="${url}" alt="Image"/>`
    }

    const parseVideo = ({ external: { url } }) => {
        return `<video controls alt="Vidéo"><source src="${url}"/></video>`
    }

    const parseCallout = ({ rich_text, icon, color }) => {
        const content = rich_text.reduce(
            (acc, richText) =>
                `${acc}<p class="callout__content__item">${parseRichText(
                    richText
                )}</p>`,
            ''
        )
        return `<section class="callout callout--${color}"><div class="callout__icon">${icon.emoji}</div><div class="callout__content">${content}</div></section>`
    }

    const parseBullettedList = ({ rich_text, color }) => {
        return rich_text.reduce(
            (acc, richText) =>
                `${acc}<ul><li class="bulleted-list__item bulleted-list__item--${color}">${parseRichText(
                    richText
                )}</li></ul>`,
            ''
        )
    }

    const parseNumberedList = ({ rich_text, color }) => {
        return rich_text.reduce(
            (acc, richText) =>
                `${acc}<ol role="list"><li class="numbered-list__item numbered-list__item--${color}">${parseRichText(
                    richText
                )}</li></ol>`,
            ''
        )
    }

    const parseTodoList = ({ rich_text, checked, color }) => {
        return rich_text.reduce(
            (acc, richText) =>
                `${acc}<ul role="list"><li class="todo-list__item todo-list__item--${color}"><dl><dt><label><input type="checkbox"${
                    !!checked ? 'checked' : ''
                }/>${parseRichText(richText)}</label></dt></dl></li></ul>`,
            ''
        )
    }

    const parseDivider = ({}) => {
        return `<hr/>`
    }

    const parseCode = ({ rich_text, caption }) => {
        const figcaption = !!caption ? parseRichTexts(caption) : undefined
        return `<figure>${wrapRichTexts(rich_text, 'pre', {
            role: 'img',
            'aria-label': figcaption,
        })}${
            figcaption ? `<figcaption>${figcaption}</figcaption>` : ''
        }</figure>`
    }

    const parseEquation = ({ expression }) => {
        return `<pre>${expression}</pre>`
    }

    const parseTable = async (
        blockId,
        { has_column_header, has_row_header }
    ) => {
        const { results } = await getBlock(blockId)
        const rows = results.reduce((acc, row, i) => {
            const cols = row.table_row.cells.reduce((acc2, col, j) => {
                const tag =
                    (has_row_header && i === 0) ||
                    (has_column_header && j === 0)
                        ? 'th'
                        : 'td'
                return (acc2 += `<${tag}>${
                    !!col[0] ? parseRichText(col[0]) : ''
                }</${tag}>`)
            }, '')
            return (acc += `<tr>${cols}</tr>`)
        }, '')
        return `<table>${rows}</table>`
    }

    const wrapRichTexts = (richTexts, tag, attributes) => {
        const content = parseRichTexts(richTexts)
        if (tag) {
            const attrs = !!attributes
                ? `${Object.entries(attributes).reduce(
                      (acc, [key, value]) => acc + ` ${key}="${value}"`,
                      ''
                  )}`
                : ''
            return `<${tag}${attrs}>${content}</${tag}>`
        } else {
            return content
        }
    }

    const parseRichTexts = (richTexts) => {
        return richTexts.reduce(
            (acc, richText) => `${acc}${parseRichText(richText)}`,
            ''
        )
    }

    const parseRichText = (richText) => {
        let result = '*'
        if (richText.annotations.bold) result = `<strong>${result}</strong>`
        if (richText.annotations.italic) result = `<i>${result}</i>`
        if (richText.annotations.strikethrough) result = `<s>${result}</s>`
        if (richText.annotations.underline) result = `<u>${result}</u>`
        if (richText.annotations.code) result = `<pre>${result}</pre>`
        return result.replace('*', richText.plain_text)
    }

    const convertBlocks = async (blocks) => {
        const results = await Promise.all(
            blocks.map(async (block, i) => {
                return await parseBlock(block)
            })
        )
        let result = results.join('')
        result = result.replace(/<\/ul><ul.*?>(<li.*?>)/g, '$1') // Lists
        result = result.replace(/<\/ol><ol.*?>(<li.*?>)/g, '$1') // Lists
        return result
    }

    const {
        properties: {
            title: { title },
        },
    } = await getPage(pageId)
    const heading = await convertBlocks(title)
    const { results } = await getBlock(pageId)
    const body = await convertBlocks(results)
    const html = `<html lang='en'><head><title>${heading}</title>${head}</head><body><h1>${heading}</h1>${body}</body></html>`
    return html
}
