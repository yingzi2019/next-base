import Dexie, { type EntityTable } from 'dexie'
import type { BookMark } from '@/utils/bookmark'

let db: Dexie & {
  bookmarks: EntityTable<BookMark, 'id'>
}

export function useBookmarkDB() {
  if (db) {
    return
  }

  db = new Dexie('bookmarks') as Dexie & {
    bookmarks: EntityTable<
      BookMark,
      'id' // primary key "id" (for the typings only)
    >
  }

  // 定义数据库的版本和模式
  db.version(1).stores({
    bookmarks: '++id, parent, type, title, description, address, tags, created, updated, icon',
  })

  // 打开数据库
  db.open().catch((err) => {
    console.error('无法打开数据库:', err.stack || err)
  })
}

// 获取所有书签
export async function getAllBookmarks() {
  try {
    const allBookmarks = await db.bookmarks.toArray()
    return allBookmarks
  }
  catch (error) {
    console.error('获取书签失败:', error)
    return []
  }
}

// 更新或创建书签（根据 address 判断）
export async function upsertBookmark(bookmark: BookMark, parentId: number | null = null) {
  try {
    let existingBookmark
    const updateData: BookMark = { ...bookmark, children: [] }
    if (parentId) {
      updateData.parent = parentId
    }

    // 处理 folder 类型书签
    if (bookmark.type === 'folder') {
      // 根据 title 和 type 查找 folder
      existingBookmark = await db.bookmarks
        .where({ title: bookmark.title, type: 'folder' })
        .first()

      if (!existingBookmark) {
        // 如果不存在，则创建新的 folder，先存储，再更新 id
        const newId = await db.bookmarks.add(updateData)
        bookmark.id = newId
      }

      // 获取当前 folder 的 id（不论是创建还是更新）
      const folderId = existingBookmark?.id || bookmark.id

      // 递归处理 children，将每个子元素的 parent_id 设置为当前 folder 的 id
      if (bookmark.children && bookmark.children.length > 0) {
        for (const child of bookmark.children) {
          await upsertBookmark({ ...child, parent: folderId })
        }
      }
    }
    else {
      // 非 folder 类型，根据 address 查找书签
      existingBookmark = await db.bookmarks
        .where('address')
        .equals(bookmark?.address || '')
        .first()

      if (existingBookmark) {
        // 如果存在，则更新书签
        const updatedCount = await db.bookmarks.update(existingBookmark.id, updateData)
        return updatedCount > 0 ? 'updated' : 'update_failed'
      }
      else {
        const newId = await db.bookmarks.add(updateData)
        return newId ? 'created' : 'create_failed'
      }
    }
  }
  catch (error) {
    console.error('更新或创建书签失败:', error)
    return 'error'
  }
}

// 更新书签（支持单个 id 和 id 列表，并且每个 id 对应不同的更新数据）
export async function updateBookmark(ids: number | number[], updatedData: Partial<BookMark> | Partial<BookMark>[]) {
  try {
    const idArray = Array.isArray(ids) ? ids : [ids] // 确保 ids 是数组
    const dataArray = Array.isArray(updatedData) ? updatedData : [updatedData] // 确保 updatedData 是数组

    // 如果 id 和数据的数量不匹配，抛出错误
    if (idArray.length !== dataArray.length) {
      throw new Error('ID 与数据不匹配')
    }

    // 执行多个更新操作
    const updatedCounts = await Promise.all(
      idArray.map((id, index) => {
        return db.bookmarks.update(id, dataArray[index] as BookMark)
      }),
    )

    // 检查更新数量
    const successfulUpdates = updatedCounts.filter(count => count > 0).length
    return successfulUpdates === idArray.length // 返回是否所有更新都成功
  }
  catch (error) {
    console.error('更新书签失败:', error)
    return false
  }
}

// 查询书签（支持单个 id 和 id 列表）
export async function getBookmarksById(ids: number | number[]) {
  try {
    const idArray = Array.isArray(ids) ? ids : [ids] // 确保 ids 是数组

    // 根据 id 数组查询书签
    const bookmarks = await db.bookmarks.where('id').anyOf(idArray).toArray()

    return bookmarks.length > 0 ? bookmarks : null // 如果找到书签，则返回，否则返回 null
  }
  catch (error) {
    console.error('查询书签失败:', error)
    return null
  }
}

// 辅助函数：递归删除 'folder' 类型书签及其子书签
async function deleteFolderAndChildren(id: number) {
  // 查询当前 'folder' 类型书签的所有子书签
  const children = await db.bookmarks.where('parent').equals(id).toArray()
  const deletedIdsSet = new Set<number>() // 使用 Set 来存储已删除的 id

  // 递归删除所有子书签
  await Promise.all(children.map(async (child) => {
    if (child.type === 'folder') {
      const ids = await deleteFolderAndChildren(child.id!) // 递归删除子文件夹及其子项
      ids.forEach(id => deletedIdsSet.add(id)) // 将子文件夹及其子项的 id 添加到 Set 中
    }
    else {
      await db.bookmarks.delete(child.id) // 删除单个书签
      deletedIdsSet.add(child.id!) // 将删除的书签的 id 添加到 Set 中
    }
  }))

  // 最后删除当前 'folder' 类型书签
  await db.bookmarks.delete(id)
  deletedIdsSet.add(id) // 将当前 'folder' 类型书签的 id 添加到 Set 中

  return [...deletedIdsSet]
}

// 删除书签（支持单个 id 和 id 列表）
export async function deleteBookmarksById(ids: number | number[]) {
  const deletedIdsSet = new Set<number>() // 使用 Set 来存储已删除的 id
  try {
    const idArray = Array.isArray(ids) ? ids : [ids] // 确保 ids 是数组

    // 批量删除书签
    await Promise.all(idArray.map(async (id) => {
      // 查询要删除的书签
      const bookmark = await db.bookmarks.get(id)

      if (!bookmark) {
        throw new Error(`未找到 id 为 ${id} 的书签`)
      }

      // 如果是 'folder' 类型，则递归删除其子书签
      if (bookmark.type === 'folder') {
        const ids = await deleteFolderAndChildren(id)
        ids.forEach(i => deletedIdsSet.add(i))
      }
      else {
        // 否则直接删除该书签
        await db.bookmarks.delete(id)
        deletedIdsSet.add(id)
      }
    }))

    return deletedIdsSet // 成功删除
  }
  catch (error) {
    console.error('删除书签失败:', error)
    return deletedIdsSet
  }
}
