/*!
 * NetSuite 2017.2 SOAP client for Node.js based apps.
 *
 * Copyright (C) 20176 by Trujay Group LLC.
 * (MIT License)
*/
/* eslint-disable camelcase */
'use strict'
const version = '2017_2'

const path = require('path')
const soap = require('soap')
const _ = require('lodash')
const nsWsdl = path.join(__dirname, 'wsdl', 'netsuite.wsdl')

const privates = new WeakMap()

class NetSuite {
  constructor (options) {
    // options: { appId: "abc", passport: { account: "x", email: "y", password: "z", roleId: 3 }, searchPrefs: { bodyFieldsOnly: false, pageSize: 10}, debug: true }
    let p = {options: options, client: null}
    privates.set(this, p)
  }

  async search (options) {
    let client = await soapClient(this)

    let type = _.get(options, ['type'])
    let searchRecord
    switch (type) {
      case 'FolderSearch':
        // <search xmlns="urn:messages_2017_2.platform.webservices.netsuite.com"><searchRecord xmlns:q1="urn:filecabinet_2017_2.documents.webservices.netsuite.com" xsi:type="q1:FolderSearch"><q1:basic /></searchRecord></search>';
        searchRecord = {
          attributes: {
            'xmlns:q1': 'urn:filecabinet_' + version + '.documents.webservices.netsuite.com',
            'xsi:type': 'q1:FolderSearch'
          }
        }
        break
      case 'FileSearch':
        searchRecord = {
          attributes: {
            'xmlns:q1': 'urn:filecabinet_' + version + '.documents.webservices.netsuite.com',
            'xsi:type': 'q1:FileSearch'
          }
        }
        break
      default:
        throw new Error('unknown search record type')
    }
    let request = {
      searchRecord: searchRecord
    }
    return callNs(client.NetSuiteService.NetSuitePort.search, request)
  }

  async searchMoreWithId (lastSearchResult) {
    let client = await soapClient(this)
    let searchId = _.get(lastSearchResult, ['searchResult', 'searchId'])
    let pageIndex = _.get(lastSearchResult, ['searchResult', 'pageIndex'])
    let totalPages = _.get(lastSearchResult, ['searchResult', 'totalPages'])
    if (!searchId) throw new Error('lastSearchResult has a blank searchId')
    if (!pageIndex) throw new Error('lastSearchResult has a blank pageIndex')
    if (pageIndex >= totalPages) return null
    return callNs(client.NetSuiteService.NetSuitePort.searchMoreWithId, {searchId: searchId, pageIndex: pageIndex + 1})
  }

  async get (options) {
    let internalId = _.get(options, ['internalId'])
    if (!internalId) throw new Error('options has a blank internalId')
    let type = _.get(options, ['type'])
    if (!type) throw new Error('options has a blank type')

    let recordRef
    switch (type) {
      case 'file':
        // <?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Header><applicationInfo xmlns="urn:messages_2016_2.platform.webservices.netsuite.com"><applicationId>CA830599-19AE-46C0-83EF-EA667DAD8BE7</applicationId></applicationInfo></soap:Header><soap:Body><get xmlns="urn:messages_2016_2.platform.webservices.netsuite.com"><baseRef xmlns:q1="urn:core_2016_2.platform.webservices.netsuite.com" xsi:type="q1:RecordRef" internalId="8" type="file" /></get></soap:Body></soap:Envelope>
        recordRef = {
          attributes: {
            'xmlns:q1': 'urn:core_' + version + '.platform.webservices.netsuite.com',
            'xsi:type': 'q1:RecordRef',
            'internalId': internalId,
            'type': type
          }
        }
        break
      default:
        throw new Error('unknown get record type: ' + type)
    }
    let client = await soapClient(this)
    let request = {
      recordRef: recordRef
    }
    return callNs(client.NetSuiteService.NetSuitePort.get, request)
  }
}

const soapClient = async (self) => {
  let p = privates.get(self)
  if (p.client) return p.client

  let options = p.options
  let promise = new Promise(function (resolve, reject) {
    soap.createClient(nsWsdl, (err, client) => {
      if (err) {
        reject(err)
      } else {
        /*
        client.addSoapHeader(
        {
            applicationInfo:
            {
                applicationId: this.appId
            },
            passport:
            {
                account: this.accountId,
                email: this.username,
                password: this.password,
                role:
                {
                    attributes:
                    {
                        internalId: this.roleId
                    }
                }
            }
        });
        */
        let appId = _.get(options, ['appId'])
        let account = _.get(options, ['passport', 'account'])
        let email = _.get(options, ['passport', 'email'])
        let password = _.get(options, ['passport', 'password'])
        let roleId = _.get(options, ['passport', 'roleId'])
        let searchPrefs = _.get(options, ['searchPrefs'])
        let debug = _.get(options, ['debug'])
        let hdr = {
          passport:
          {
            account: account,
            email: email,
            password: password
          }}
        if (roleId) {
          hdr.passport.role = {
            attributes:
            {
              internalId: roleId
            }
          }
        }
        if (appId) {
          hdr.applicationInfo = {applicationId: appId}
        }
        if (searchPrefs) {
          // <searchPreferences xmlns="urn:messages_2016_2.platform.webservices.netsuite.com"><bodyFieldsOnly>false</bodyFieldsOnly><pageSize>10</pageSize></searchPreferences></
          hdr.searchPreferences = searchPrefs
        }
        client.addSoapHeader(hdr)
        if (debug) {
          client.on('request', function (req) {
            console.log(req)
          })
        }
        p.client = client
        privates.set(self, p)
        resolve(client)
      }
    })
  })
  return promise
}

const callNs = (func, args) => {
  var p = new Promise(function (resolve, reject) {
    try {
      func(args, function (err, result) {
        if (err) {
          reject(err)
        } else {
          resolve(result)
        }
      })
    } catch (err) {
      reject(err)
    }
  })
  return p
}

module.exports = NetSuite
