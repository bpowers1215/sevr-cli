'use strict'

module.exports = function(collDefs, collData) {

	const _collections = Object.keys(collDefs).reduce((prev, key) => {
		const data = collData && collData.hasOwnProperty(key) ? collData[key] : []
		return Object.assign({}, prev, {
			[key]: new CollectionMock(collDefs[key], data)
		})
	}, {})

	return {
		collections: _collections
	}
}


const CollectionMock = function(def, data) {
	let fieldTypes = {}

	return {
		// Test Helpers -------------------------------------
		setFieldTypes(types) {
			fieldTypes = types
		},

		// Mocks --------------------------------------------
		defaultField: def.defaultField,
		definition: {
			getFields(){
				return def.fields
			}
		},

		getFields() { return def.fields },

		create(data) {
			return Promise.resolve(data)
		},

		read(query, selection) {
			return Promise.resolve(
				data.map(doc => {
					return new DocumentMock(doc)
				})
			)
		},

		updateById() {
			return Promise.resolve()
		},

		delById() {
			return Promise.resolve()
		},

		getRefOptions() {
			return Promise.resolve({})
		},

		getFieldTypes(name) {
			return fieldTypes[name]
		}
	}
}


const DocumentMock = function(data) {
	const mock = Object.create({
		toObject() { return this },
		isSelected() { return true }
	})

	Object.assign(mock, data)
	return mock
}
