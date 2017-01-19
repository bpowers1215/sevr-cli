'use strict'

const util  = require('util')
const chalk = require('chalk')
const _ = require('lodash')

module.exports = sevr => function(args) {
	return new Promise((res, rej) => {
		const coll = sevr.collections[args.collection]

		if (!coll) {
			return rej(`Could not find collection ${args.collection}`)
		}

		const displayField = coll.defaultField

		let query = {}

		if (args.query) {
			const pairs = args.query.split('&')
			pairs.forEach(pair => {
				const parts = pair.split('=').map(part => { return part.trim() })
				query[parts[0]] = parts[1]
			})
		}

		coll
			.read(query, null, true)
			.then(docs => {
				if (!docs.length) {
					this.log('No documents found')
					return res()
				}

				this.prompt({
					type: 'list',
					name: 'document',
					message: `Found ${docs.length} documents:`,
					choices: docs.map((doc, i) => {
						return {
							name: doc[displayField],
							value: i
						}
					})
				})
				.then(result => {
					const doc = docs[result.document].toObject()
					const filledDoc = fillPopulated(doc, coll.definition._fields)
					
					this.log(getDocumentOutput(filledDoc, coll.definition._fields, '%s'))
					res()
				})
			})
			.catch(err => {
				this.log(err)
				rej(err)
			})
	})
}

/**
 * Replace populated fields with only the default field value
 * @param  {Object} doc
 * @param  {Object} fields
 * @return {Object}
 */
const fillPopulated = function(doc, fields) {
	return Object.keys(fields).reduce((prev, key) => {
		let val

		if (fields[key].hasOwnProperty('referenceCollection')) {
			const displayField = fields[key].referenceCollection.defaultField

			if (Array.isArray(doc[key])) {
				val = doc[key].map(data => {
					return data[displayField]
				})
			} else {
				val = doc[key][displayField]
			}
		} else {
			val = doc[key]
		}
		return Object.assign({}, prev, {
			[key]: val
		})
	}, { _id: doc._id })
}

/**
 * Get the string representation of the document
 * @param  {Object} doc
 * @param  {Object} def
 * @param  {String} [labelTemplate='%s']
 * @return {String}
 */
const getDocumentOutput = function(doc, def, labelTemplate) {
	return Object.keys(doc)
		.map(key => {
			let field = doc[key]
			const fieldDef = def[key]
			if (!field || (!fieldDef && key != '_id')) {
				return null
			}

			const name = key == '_id' ? 'id' : fieldDef.label
			const template = labelTemplate || '%s'
			const label = util.format(template, name)
			
			if (typeof field == 'object' && key != '_id') {
				let displayField = fieldDef.type.display ? fieldDef.type.display : '_id'
				if (fieldDef.isMultiValue) {
					// Output list of field values
					let valueList = field.reduce((acc, curr) => {
						let item
						if (fieldDef.isLinked) {
							item = getDocumentOutput(_.pick(curr, displayField), _.pick(fieldDef.getLinkedCollection()._definition._fields, displayField), false)
						}else{
							item = curr[displayField]
						}
						acc.push(item)
						return acc
					}, [])
					field = valueList.join(', ')
				} else {
					if (fieldDef.isLinked) {
						// Output linked collection field value(s)
						return getDocumentOutput(_.pick(field, displayField), _.pick(fieldDef.getLinkedCollection()._definition._fields, displayField), label + ' (%s)')
					}
					return getDocumentOutput(field, fieldDef.type, label + ' (%s)')
				}
			}
			
			return labelTemplate !== false ? `${chalk.yellow(label)}: ${field}` : `${field}`

		})
		.filter(line => { return line !== null })
		.join('\n')
}
