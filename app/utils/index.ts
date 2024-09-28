// 封装文件读取操作为一个 Promise
export function readFileAsText(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (event.target?.result) {
        resolve(event.target.result as string)
      }
      else {
        reject(new Error('File reading failed'))
      }
    }

    reader.onerror = () => {
      reject(new Error('File reading error'))
    }

    reader.readAsText(file)
  })
}
