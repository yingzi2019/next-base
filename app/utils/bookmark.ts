export interface BookMark {
  id?: number
  type: 'bookmark' | 'folder'
  title: string
  parent?: number
  parents?: BookMark[]
  description?: string
  address?: string
  tags?: string[]
  created: string
  updated: string
  icon?: string
  children?: BookMark[]
}

function getParents(element: Element) {
  const parents: BookMark[] = []
  let currentElement = element.parentElement

  while (currentElement !== null) {
    if (currentElement.tagName.toLowerCase() === 'dt') {
      const parent = currentElement.querySelector('h3')

      if (parent) {
        parents.push({
          type: 'folder',
          title: parent?.textContent || '',
          created: '',
          updated: '',
        })
      }
    }
    currentElement = currentElement.parentElement
  }

  return parents.slice(0, -1)
}

export function parseBookmarksHtml(htmlString: string): any[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlString, 'text/html')
  const bookmarks: any[] = []
  const seenUrls = new Set<string>() // 用于存储已经处理过的书签 URL

  function parseFolder(folder: Element): any[] {
    const items: BookMark[] = []

    // 解析书签 <A> 标签
    folder.querySelectorAll(':scope a').forEach((a: Element) => {
      const url = ((a as HTMLAnchorElement).href || '') as string

      if (!seenUrls.has(url)) {
        // 只添加未处理过的书签
        seenUrls.add(url)
        items.push({
          type: 'bookmark',
          title: a.textContent || '',
          tags: [],
          parents: getParents(a),
          description: '',
          address: url,
          created: '',
          updated: '',
          icon: a.getAttribute('icon') || '',
        })
      }
    })

    return items
  }

  // 解析所有根级的文件夹
  doc.querySelectorAll('body > dl > dt').forEach((dl: Element) => {
    bookmarks.push(parseFolder(dl))
  })

  return bookmarks.flat()
}

// Helper function to convert a single node
export function parseBookmarksJson(jsonData: any) {
  function parserNode(node: any, parents: BookMark[] = []) {
    const bookmark: BookMark = {
      type: node.type === 'folder' ? 'folder' : 'bookmark',
      title: node.name,
      parents,
      description: '',
      address: node.url || '', // Only present if it's a bookmark
      tags: [],
      created: '',
      updated: '',
      icon: '', // You can set an icon URL if available
    }

    if (node.children && node.children.length > 0) {
      return node.children.map((child: any) => parserNode(child, [bookmark, ...(node.parents || [])]))
    }

    return bookmark
  }

  return Object.values(jsonData?.roots || {}).map(i => (i as any)?.children || []).flat().map(item => parserNode(item)).flat()
}

export function findOrCreateParent(parents: BookMark[], parent: BookMark): BookMark {
  let current = parents.find(p => p.title === parent.title)
  if (!current) {
    current = {
      type: 'folder',
      title: parent.title,
      created: parent.created,
      updated: parent.updated,
      children: [],
    }
    parents.push(current)
  }
  return current
}

export function buildNestedBookmarks(bookmarks: BookMark[]): BookMark[] {
  const rootBookmarks: BookMark[] = []

  bookmarks.forEach((bookmark) => {
    if (!bookmark.parents || bookmark.parents.length === 0) {
      rootBookmarks.push(bookmark)
    }
    else {
      // 根据 parents 逐层查找或创建父级节点
      let currentParents = rootBookmarks
      bookmark.parents.reverse().forEach((parent) => {
        const _parent = findOrCreateParent(currentParents, parent)
        currentParents = _parent.children!
      })

      currentParents.push(bookmark)
    }
  })

  return rootBookmarks
}
