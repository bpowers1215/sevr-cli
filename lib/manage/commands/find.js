'use strict'

const util  = require('util')
const chalk = require('chalk')

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
					const fields = coll.getFields()
					const filledDoc = fillPopulated(doc, fields)
					
					this.log(getDocumentOutput(filledDoc, fields, '%s'))
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
 
			if (typeof field == 'object' && !Array.isArray(field) && key != '_id') {
				if (fieldDef.schemaType.name != "ObjectId") {
					return getDocumentOutput(field, fieldDef.schemaType, label + ' (%s)')
				}
				
				// Get output for linked document
				if (typeof fieldDef.schemaType.display == 'string' && typeof field[fieldDef.schemaType.display] == 'string') {
					// Output linked document display field
					field = field[fieldDef.schemaType.display]
				} else {
					// Output linked document ID
					field = field['_id']
				}
			} else if (Array.isArray(field)) {
				// Output comma separated list of array values
				let valueList = field.reduce((acc, curr) => {
					if (fieldDef.schemaType.name == "ObjectId") {
						if (typeof fieldDef.schemaType.display == 'string' && typeof curr[fieldDef.schemaType.display] == 'string') {
							acc.push(curr[fieldDef.schemaType.display])
						} else {
							acc.push(curr['_id'])
						}
					}
					return acc
				}, [])
				field = valueList.join()
			}
			
			return `${chalk.yellow(label)}: ${field}`

		})
		.filter(line => { return line !== null })
		.join('\n')
}
