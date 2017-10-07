const _ = require('lodash')
const csvWriter = require('csv-write-stream')
const fs = require('fs')
const NetSuite = require('../netsuite.js')

/*
    Self contained script to pull all files from the document cabinet and save them to disk, along with csv's holding file
    and folder metadata.
*/
const ns = new NetSuite({
  appId: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
  passport: {account: 'TSTDRV111111', email: 'you@yourcompany.com', password: 'shhhh'},
  searchPrefs: {bodyFieldsOnly: false, pageSize: 10},
  debug: false
})

const ourDir = './'
const folderMetaData = ourDir + 'FolderMeta.csv'
const fileMetaData = ourDir + 'FileMeta.csv'

async function main () {
  let folders = await getAllFolders()
  await getAllFiles(folders)
}

async function getAllFolders () {
  let writer = csvWriter()
  writer.pipe(fs.createWriteStream(folderMetaData))

  let foldersByInternalId = {}
  let result = await ns.search({type: 'FolderSearch'})
  try {
    let folderCount = 0
    while (result) {
      checkSearchResult(result)
      let records = _.get(result, ['searchResult', 'recordList', 'record']) || []
      for (let i = 0; i < records.length; i++) {
        let csvRow = folderRecToCsv(records[i])
        foldersByInternalId[csvRow.internalId] = csvRow
        writer.write(csvRow)
        folderCount++
      }
      result = await moreWithRetry(result)
      console.log('folders processed: ' + folderCount)
    }
  } finally {
    writer.end()
  }

  // generate full folder names
  for (let id in foldersByInternalId) {
    if (!foldersByInternalId.hasOwnProperty(id)) continue
    let folder = foldersByInternalId[id]
    let fullName = [folder.name]
    let parent = foldersByInternalId[folder.parentInternalId]
    while (parent) {
      fullName.push(parent.name)
      parent = foldersByInternalId[parent.parentInternalId]
    }
    folder.fullName = fullName.reverse().join('/')
  }
  return foldersByInternalId
}

const folderRecToCsv = (rec) => {
  let csv = {
    internalId: _.get(rec, ['attributes', 'internalId']),
    type: _.get(rec, ['attributes', 'xsi:type']),
    name: _.get(rec, ['name']),
    parentInternalId: _.get(rec, ['parent', 'attributes', 'internalId']),
    parentName: _.get(rec, ['parent', 'name']),
    description: _.get(rec, ['description']),
    isInactive: _.get(rec, ['isInactive']),
    folderType: _.get(rec, ['folderType'])
  }
  return csv
}

async function getAllFiles (folders) {
  let writer = csvWriter()
  writer.pipe(fs.createWriteStream(fileMetaData))

  let result = await ns.search({type: 'FileSearch'})
  let total = _.get(result, ['searchResult', 'totalRecords'])
  console.log('total records: ' + total)
  let fileCount = 0
  let maxCount = 10000
  let startAtInternalId = null
  try {
    while (result && fileCount < maxCount) {
      checkSearchResult(result)
      let records = _.get(result, ['searchResult', 'recordList', 'record']) || []
      for (let i = 0; i < records.length && fileCount < maxCount; i++) {
        let csvRow = fileRecToCsv(records[i])
        csvRow.fullName = (csvRow.folderInternalId != null ? _.get(folders, [csvRow.folderInternalId, 'fullName']) + '/' : '') + csvRow.name
        writer.write(csvRow)
        if (startAtInternalId == null || startAtInternalId === csvRow.internalId) {
          startAtInternalId = null
          await downloadWithRetries(csvRow.internalId, ourDir + csvRow.internalId)
        }
        fileCount++
      }
      result = await moreWithRetry(result)
      console.log('files processed: ' + fileCount + ' of ' + total)
    }
  } finally {
    writer.end()
  }
}

const fileRecToCsv = (rec) => {
  let csv = {
    internalId: _.get(rec, ['attributes', 'internalId']),
    type: _.get(rec, ['attributes', 'xsi:type']),
    name: _.get(rec, ['name']),
    mediaTypeName: _.get(rec, ['mediaTypeName']),
    fileType: _.get(rec, ['fileType']),
    folderInternalId: _.get(rec, ['folder', 'attributes', 'internalId']),
    folderName: _.get(rec, ['folder', 'name']),
    fileSize: _.get(rec, ['fileSize']),
    url: _.get(rec, ['url']),
    textFileEncoding: _.get(rec, ['textFileEncoding']),
    isOnline: _.get(rec, ['isOnline']),
    isInactive: _.get(rec, ['isInactive']),
    class: _.get(rec, ['class']),
    bundleable: _.get(rec, ['bundleable']),
    department: _.get(rec, ['department']),
    hideInBundle: _.get(rec, ['hideInBundle']),
    isPrivate: _.get(rec, ['isPrivate']),
    caption: _.get(rec, ['caption']),
    lastModifiedDate: _.get(rec, ['lastModifiedDate']),
    createdDate: _.get(rec, ['createdDate'])
  }
  return csv
}

const moreWithRetry = async (result) => {
  let retries = 3
  while (true) {
    try {
      return ns.searchMoreWithId(result)
    } catch (err) {
      retries--
      if (retries === 0) throw err
      console.log('moreWithRetry failed, ' + retries + ' retries remain')
      await sleep(5000)
    }
  }
}

const downloadWithRetries = async (internalId, filename) => {
  let retries = 3
  while (true) {
    try {
      let result = await ns.get({type: 'file', internalId: internalId})
      checkReadResponse(result)
      let b64Content = _.get(result, ['readResponse', 'record', 'content'])
      if (b64Content) {
        let buf = Buffer.from(b64Content, 'base64')
        await bufferToFile(buf, filename)
      }
      return
    } catch (err) {
      retries--
      if (retries === 0 || err.message.indexOf('INSUFFICIENT_PERMISSION') !== -1 || err.message.indexOf('FILE_NOT_DOWNLOADABLE') !== -1) throw err
      console.log('downloadWithRetries failed, ' + retries + ' retries remain')
      await sleep(5000)
    }
  }
}

const bufferToFile = (buffer, filename) => {
  let p = new Promise((resolve, reject) => {
    fs.open(filename, 'w', function (err, fd) {
      if (err) {
        reject(err)
      } else {
        fs.write(fd, buffer, 0, buffer.length, null, function (err) {
          if (err) {
            reject(err)
          } else {
            fs.close(fd, function () {
              resolve()
            })
          }
        })
      }
    })
  })
  return p
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const checkSearchResult = (result) => {
  let success = _.get(result, ['searchResult', 'status', 'attributes', 'isSuccess']) === 'true'
  if (!success) throw new Error(JSON.stringify(result))
}

const checkReadResponse = (result) => {
  let success = _.get(result, ['readResponse', 'status', 'attributes', 'isSuccess']) === 'true'
  if (!success) throw new Error(JSON.stringify(result))
}

main()
  .then(() => {
    console.log('*** done')
  })
  .catch(err => {
    console.error('*** failed')
    console.error(err)
  })
