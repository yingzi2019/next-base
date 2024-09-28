interface Contact {
  FN: string
  N: string
  NickName: string
}

// 函数用于解码 QUOTED-PRINTABLE 编码
// function decodeQuotedPrintable(encoded: string) {
//   return encoded.replace(/=([0-9A-F]{2})/g, (match, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
// }

function decodeQuotedPrintable(input: string) {
  input = input.replace(/=$/, '')
  try {
    return decodeURI(input.replace(/\\n| /gu, '').replace(/={1,2}/gu, '%'))
  }
  catch (e: Error) {
    console.log(input)
    return ''
  }
}

export async function parseContactsVCF(text) {
  const vCardEntries = text.trim().split(/END: ?VCARD\r\n/i)
  const contacts: Contact[] = []
  vCardEntries.forEach((entry) => {
    const lines: string[] = entry.trim().split(/\r\n/)
    const contact: Record<string, any> = {}

    lines.forEach((line) => {
      let [key, value] = line.split(':') as [string, string]
      if (/^(BEGIN|VERSION)/i.test(key) || !value) {
        return
      }
      key = key.replace(/CHARSET=UTF-8;?/i, '')
      value = decodeURIComponent(value)
      if (key.includes('ENCODING')) {
        const encoding = /ENCODING=([\w-]+)/i.exec(key)?.[1] || ''
        if (encoding?.toUpperCase() === 'QUOTED-PRINTABLE') {
          value = value.split(';').filter(i => !!i).map(decodeQuotedPrintable).join(';')
        }
        if (encoding?.toUpperCase() === 'BASE64') {
        }
      }
      key = key.split(';')[0]!
      key = key.trim()
      value = value.trim()

      // 处理特殊情况：N 和 FN 字段可能包含多个分号
      if (key === 'N' || key === 'FN') {
        value = value.split(';').filter(i => !!i).join('')
      }

      // 添加到联系人对象中
      if (contact[key]) {
        // 如果已经存在同名的键，则将值转为数组存储
        if (!Array.isArray(contact[key])) {
          contact[key] = [contact[key]]
        }
        contact[key].push(value)
      }
      else {
        contact[key] = value
      }
    })

    // 将联系人对象添加到数组中
    contacts.push(contact)
  })

  console.log(contacts)
}
