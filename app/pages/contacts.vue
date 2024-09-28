<script setup lang="ts">
import { readFileAsText } from '@/utils'
import { parseContactsVCF } from '@/utils/contacts'

const files = ref([])
const fileInputInstance = ref(null)

async function onChoiceFile({ files }) {
  const file = files?.[0] || ''
  if (!file?.name) {
    return
  }

  if (file.name.toLowerCase().endsWith('.vcf')) {
    const text = await readFileAsText(file)
    const contacts = parseContactsVCF(text)
  }
}

function onUpload() {
  console.log('on upload')
}
</script>

<template>
  <div>
    <div>
      <p>联系人上传</p>
      <FileUpload
        ref="fileInputInstance" v-model="files" mode="basic" :auto="true"
        choose-label="Browser" accept=".vcf, .xlsx" @upload="onUpload" @select="onChoiceFile"
      />
    </div>
  </div>
</template>
