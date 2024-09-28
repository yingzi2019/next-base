<script setup lang="ts">
import { readFileAsText } from '@/utils'
import { buildNestedBookmarks, parseBookmarksHtml, parseBookmarksJson } from '@/utils/bookmark'
import { deleteBookmarksById, getAllBookmarks, updateBookmark, upsertBookmark, useBookmarkDB } from '@/databases/bookmarks'
import type { BookMark } from '@/utils/bookmark'

const toast = useToast()
const confirm = useConfirm()
const currentBookmark = ref<BookMark>({})

const files = ref([])
const fileInputInstance = ref(null)
const allBookmarks = ref<BookMark[]>([])
const viewAllBookmarks = computed(() => {
  return transformBookmarks(buildNestedBookmarks(allBookmarks.value))
})

const editVisible = ref(false)

interface BookmarkRow {
  key: string
  data: BookMark
  children: BookmarkRow[]
}

function transformBookmarks(bookmarks: BookMark[], parentKey = '0'): BookmarkRow[] {
  return bookmarks.map((bookmark, i) => {
    const key = `${parentKey}-${i}`
    const children: BookmarkRow[] = bookmark.children ? transformBookmarks(bookmark.children, key) : []

    return {
      key,
      data: bookmark,
      children,
    } as BookmarkRow
  })
}

async function onChoiceFile({ files }) {
  const file = files?.[0] || ''
  if (!file?.name) {
    return
  }

  let bookmarks: BookMark[] = []

  if (file.name.toLowerCase() === 'bookmarks' || file.name.endsWith('.json')) {
    const text = await readFileAsText(file)
    bookmarks = parseBookmarksJson(JSON.parse(text))
    console.log('file type is json.', buildNestedBookmarks(bookmarks))
  }

  if (file.name.endsWith('.html')) {
    const text = await readFileAsText(file)
    bookmarks = parseBookmarksHtml(text)
    console.log(buildNestedBookmarks(bookmarks))
  }

  bookmarks = buildNestedBookmarks(bookmarks)
  bookmarks.forEach(item => upsertBookmark(item))
}

async function handlerGetAllBookmarks() {
  allBookmarks.value = await getAllBookmarks() as BookMark[]
}

function onUpload() {
  console.log('on upload')
}

function handleEditBookmark(event: MouseEvent, bookmarkData: BookmarkRow) {
  editVisible.value = true
  currentBookmark.value = toRaw({ ...(bookmarkData.data), children: [] })
  console.log(currentBookmark.value, 'on update')
}
function handleSaveBookmark() {
  updateBookmark([currentBookmark.value.id!], [JSON.parse(JSON.stringify(currentBookmark.value))])
  const index = allBookmarks.value.findIndex(i => i.id === currentBookmark.value.id)
  if (index !== -1) {
    allBookmarks.value[index] = currentBookmark.value
  }
  editVisible.value = false
}

function handleDeleteBookmark(event: MouseEvent, bookmarkData: BookmarkRow) {
  confirm.require({
    group: 'button',
    target: event.currentTarget as HTMLElement || undefined,
    message: 'Do you want to delete this bookmark?',
    icon: 'pi pi-info-circle',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: 'Delete',
      severity: 'danger',
    },
    accept: async () => {
      try {
        console.log(bookmarkData.data.type)
        if (bookmarkData.data.type === 'folder') {
          return confirm.require({
            group: 'dialog',
            message: 'This will delete all subitems, do you want to continue?',
            header: 'Danger Zone',
            icon: 'pi pi-info-circle',
            rejectLabel: 'Cancel',
            rejectProps: {
              label: 'Cancel',
              severity: 'secondary',
              outlined: true,
            },
            acceptProps: {
              label: 'Continue',
              severity: 'danger',
            },
            accept: async () => {
              const targetId = bookmarkData.data.id as number
              await deleteBookmarksById(targetId)
              handlerGetAllBookmarks()
              toast.add({ severity: 'info', summary: 'Successful', detail: `Deleted \`${bookmarkData.data.title}\` folder`, life: 3000 })
            },
          })
        }
        const targetId = bookmarkData.data.id as number
        await deleteBookmarksById(targetId)
        handlerGetAllBookmarks()
        toast.add({ severity: 'info', summary: 'Successful', detail: `Deleted \`${bookmarkData.data.title}\``, life: 3000 })
      }
      catch (e: Error) {
        toast.add({ severity: 'error', summary: 'Failed', detail: `Deleted \`${bookmarkData.data.title}\` failed.`, life: 3000 })
      }
    },
  })
}

onMounted(() => {
  useBookmarkDB()
  handlerGetAllBookmarks()
})
</script>

<template>
  <div>
    <div>
      <FileUpload
        ref="fileInputInstance" v-model="files" mode="basic" :auto="true"
        choose-label="Browse" @upload="onUpload" @select="onChoiceFile"
      />
    </div>
    <div>
      <Button @click="handlerGetAllBookmarks()">
        get all bookmarks
      </Button>
    </div>
    <Card>
      <template #content>
        <Toast />
        <ConfirmPopup group="button" />
        <ConfirmDialog group="dialog" />
        <TreeTable :value="viewAllBookmarks" size="small">
          <Column field="id" header="ID" style="width: 5%;" class="text-center" />
          <Column field="type" header="Type" expander style="width: 12%" />
          <Column field="title" header="Title" style="width: 16%" />
          <Column field="address" header="Address" style="width: 20%" />
          <Column style="width: 10rem">
            <template #body="{ node }">
              <div class="flex flex-wrap gap-4">
                <Button type="button" icon="pi pi-pencil" rounded severity="success" @click="handleEditBookmark($event, node)" />
                <Button label="Delete" severity="danger" outlined size="small" @click="handleDeleteBookmark($event, node)" />
              </div>
            </template>
          </Column>
        </TreeTable>
      </template>
    </Card>

    <div>
      <Dialog v-model:visible="editVisible" modal :style="{ width: '32rem' }">
        <template #header>
          <h3>
            Edit Bookmark
          </h3>
        </template>
        <div class="mb-4 flex flex-col items-center gap-4">
          <label for="username" class="w-full text-left font-semibold">Title</label>
          <InputText id="username" v-model="currentBookmark.title" class="w-full flex-auto" autocomplete="off" />
        </div>
        <div class="mb-8 flex flex-col items-center gap-4">
          <label for="address" class="w-full text-left font-semibold">Address</label>
          <Textarea id="address" v-model="currentBookmark.address" class="w-full flex-auto break-all" autocomplete="off" rows="5" cols="30" />
        </div>
        <div class="flex justify-end gap-2">
          <Button type="button" label="Cancel" severity="secondary" @click="editVisible = false" />
          <Button type="button" label="Save" @click="handleSaveBookmark()" />
        </div>
      </Dialog>
    </div>
  </div>
</template>
