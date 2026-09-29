const { ObjectId } = require("mongodb");

function isValidObjectId(id) {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === String(id);
}

function toObjectId(id) {
  return new ObjectId(id);
}

module.exports = { isValidObjectId, toObjectId };
