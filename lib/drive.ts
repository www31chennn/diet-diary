import { google } from 'googleapis'

const FOLDER_NAME = 'Diet Diary'

function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.drive({ version: 'v3', auth })
}

async function getOrCreateFolder(drive: ReturnType<typeof google.drive>): Promise<string> {
  // 搜尋現有資料夾，取最舊的那個
  const res = await drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, createdTime)',
    spaces: 'drive',
    orderBy: 'createdTime',
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  // 建立資料夾前再查一次（避免競爭條件）
  const recheck = await drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  })
  if (recheck.data.files && recheck.data.files.length > 0) {
    return recheck.data.files[0].id!
  }

  const folder = await drive.files.create({
    requestBody: {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  })
  console.log(`[Drive] Created folder: ${FOLDER_NAME}`)
  return folder.data.id!
}

export async function readDriveFile(accessToken: string, filename: string): Promise<unknown> {
  try {
    const drive = getDriveClient(accessToken)
    const folderId = await getOrCreateFolder(drive)

    const res = await drive.files.list({
      q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
    })

    if (!res.data.files || res.data.files.length === 0) return null

    const content = await drive.files.get(
      { fileId: res.data.files[0].id!, alt: 'media' },
      { responseType: 'text' }
    )
    console.log(`[Drive] Read OK: ${filename}`)
    return JSON.parse(content.data as string)
  } catch (e) {
    console.error(`[Drive] Read error for ${filename}:`, e)
    return null
  }
}

export async function writeDriveFile(accessToken: string, filename: string, data: unknown): Promise<void> {
  try {
    const drive = getDriveClient(accessToken)
    const folderId = await getOrCreateFolder(drive)

    const res = await drive.files.list({
      q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
    })

    const body = JSON.stringify(data, null, 2)
    const media = { mimeType: 'application/json', body }

    if (res.data.files && res.data.files.length > 0) {
      await drive.files.update({ fileId: res.data.files[0].id!, media })
    } else {
      await drive.files.create({
        requestBody: { name: filename, parents: [folderId] },
        media,
        fields: 'id',
      })
    }
    console.log(`[Drive] Write OK: ${filename}`)
  } catch (e) {
    console.error(`[Drive] Write error for ${filename}:`, e)
    throw e
  }
}