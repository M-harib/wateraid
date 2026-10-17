export type DocumentCategory = 'Funding call' | 'Agreement' | 'Proposal' | 'Report' | 'Framework' | 'Budget' | 'Other'

export type LocalDocument = {
  id: string
  projectId: string
  name: string
  category: DocumentCategory
  mimeType: string
  size: number
  addedAt: string
  blob: Blob
  extractedText: string
  pageCount?: number
}

const databaseName = 'grantguard.project-documents.v1'
const storeName = 'documents'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(storeName, { keyPath: 'id' })
      store.createIndex('projectId', 'projectId')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: unknown) => void) => void): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => { database.close(); reject(transaction.error) }
    run(transaction.objectStore(storeName), resolve, reject)
  })
}

export function listLocalDocuments(projectId: string): Promise<LocalDocument[]> {
  return withStore('readonly', (store, resolve, reject) => {
    const request = store.index('projectId').getAll(projectId)
    request.onsuccess = () => resolve((request.result as LocalDocument[]).sort((a, b) => b.addedAt.localeCompare(a.addedAt)))
    request.onerror = () => reject(request.error)
  })
}

export function deleteLocalDocument(id: string): Promise<void> {
  return withStore('readwrite', (store, resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function deleteProjectDocuments(projectId: string): Promise<void> {
  for (const document of await listLocalDocuments(projectId)) await deleteLocalDocument(document.id)
}

async function extractText(file: File): Promise<{ text: string; pageCount?: number }> {
  if (/\.(txt|md)$/i.test(file.name)) return { text: (await file.text()).slice(0, 100_000) }
  if (!/\.pdf$/i.test(file.name)) return { text: '' }
  const { pdfjs } = await import('react-pdf')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const pdf = await task.promise
    const pages: string[] = []
    for (let number = 1; number <= Math.min(pdf.numPages, 30); number++) {
      const page = await pdf.getPage(number)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim())
    }
    return { text: pages.map((text, index) => `Page ${index + 1}\n${text}`).join('\n\n').slice(0, 100_000), pageCount: pdf.numPages }
  } finally { await task.destroy() }
}

export async function addLocalDocument(projectId: string, file: File, category: DocumentCategory): Promise<LocalDocument> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Each document must be under 10 MB for this browser demo.')
  if (!/\.(pdf|txt|md|docx|xlsx)$/i.test(file.name)) throw new Error('Use PDF, TXT, MD, DOCX, or XLSX files.')
  const { text, pageCount } = await extractText(file)
  const document: LocalDocument = {
    id: crypto.randomUUID(), projectId, name: file.name, category,
    mimeType: file.type, size: file.size, addedAt: new Date().toISOString(),
    blob: file, extractedText: text, ...(pageCount ? { pageCount } : {}),
  }
  await withStore('readwrite', (store, resolve, reject) => {
    const request = store.put(document)
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error)
  })
  return document
}
