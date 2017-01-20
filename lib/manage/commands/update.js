'use strict'

const _       = require('lodash')
const prompts = require('../prompts')

module.exports = sevr => function(args) {
	return new Promise((res, rej) => {
		const coll = sevr.collections[args.collection]
		
		if (!coll) {
			return rej(`Could not find collection ${args.collection}`)
		}

		const displayField = coll.defaultField
		const fields = coll.definition.getFields(true)
		let query = {}
		let select = args.options.select ? args.options.select.split(',') : []

		// Parse the query string into an object that can be
		// understood by MongoDB
		if (args.query) {
			const pairs = args.query.split('&')
			pairs.forEach(pair => {
				const parts = pair.split('=').map(part => { return part.trim().replace(/'/g, "") })
				query[parts[0]] = parts[1]
			})
		}
		
		coll
			.read(query, select)
			.then(docs => {
				if (!docs.length) {
					this.log('No documents found')
					return res()
				}

				return new Promise(res => {
					this.prompt({
						type: 'list',
						name: 'documentIndex',
						message: `Select the document to update (${docs.length} found):`,
						choices: docs.map((doc, i) => {
							return {
								name: doc[displayField],
								value: i
							}
						})
					})
					.then(answer => {
						res(docs[answer.documentIndex])
					})
				})
			})
			.then(document => {
				return coll.getRefOptions()
					.then(refOptions => {
						return ({
							document: document,
							refOptions: refOptions
						})
					})
			})
			.then(data => {
				const doc = flattenDocument(data.document, fields)
				const fieldPrompts = Object.keys(fields)
					.filter(key => {
						return data.document.isSelected(key)
					})
					.reduce((prev, key) => {
						return prev.concat(
							prompts.getFieldPrompts(coll, fields[key], data.refOptions, {
								name: key,
								message: `${fields[key].label}: `,
								default: doc[key]
							})
						)
					}, [])

				return new Promise((res, rej) => {
					this.prompt(fieldPrompts)
						.then(results => {
							const doc = joinComplexData(results)
							coll.updateById(data.document._id, doc)
								.then(() => res())
								.catch(err => rej(err))
						})
				})
			})
			.then(() => {
				this.log('Updated document')
				res()
			})
			.catch(err => { rej(err) })
	})
}

const flattenDocument = function(doc, flatFields) {
	return Object.keys(flatFields).reduce((prev, key) => {
		return Object.assign({}, prev, {
			[key]: _.at(doc, key)
		})
	}, { _id: doc._id })
}

const joinComplexData = function(data) {
	return Object.keys(data).reduce((map, key) => {
		if (key.indexOf('.') < 0) {
			map[key] = data[key]
		} else {
			const parts = key.split('.')
			const obj = Object.assign({}, map[parts[0]], {
				[parts[1]]: data[key]
			})
			map[parts[0]] = obj
		}

		return map
	}, {})
}
