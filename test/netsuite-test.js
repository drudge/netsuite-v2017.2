/* eslint-env mocha */
'use strict'
const path = require('path')
const cwd = process.cwd()
const NetSuite = require(path.join(cwd, 'netsuite'))
const chai = require('chai')
const expect = chai.expect

const config = require('config')

describe('NetSuite class', function () {
  this.timeout(24 * 60 * 60 * 1000)
  it('should export a function', function () {
    expect(NetSuite).to.be.a('function')
    expect(new NetSuite({})).to.be.a('object')
  })
  it('should search files', async function () {
    let ns = new NetSuite(opts())
    let result = await ns.search({type: 'FolderSearch'})
    expect(result.searchResult).to.be.a('object')
    expect(result.searchResult.status).to.be.a('object')
    expect(result.searchResult.status.attributes).to.be.a('object')
    expect(result.searchResult.status.attributes.isSuccess).to.equal('true')
    expect(result.searchResult.pageIndex).to.equal(1)

    let more = await ns.searchMoreWithId(result)
    expect(more.searchResult).to.be.a('object')
    expect(more.searchResult.pageIndex).to.equal(2)
  })
})

const opts = () => {
  // { appId: "abc", passport: { account: "x", email: "y", password: "z", roleId: 3 }, searchPrefs: { bodyFieldsOnly: false, pageSize: 10}, debug: true }
  return {
    appId: config.get('appId'),
    passport: {account: config.get('account'), email: config.get('email'), password: config.get('password')},
    searchPrefs: {bodyFieldsOnly: false, pageSize: 10},
    debug: false
  }
}
