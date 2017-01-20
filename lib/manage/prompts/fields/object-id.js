'use strict'

module.exports = (field, coll, refOptions) => {
	const options = refOptions.find(opt => {
		return opt.field === field.name
	}).options
	
	const displayField = field.type.display

	if (!options.length) {
		return null
	}

	return {
		type: field.isMultiValue ? 'checkbox' : 'list',
		choices: options.map(option => {
			return {
				name: option[displayField],
				value: option._id
			}
		})
	}
}
