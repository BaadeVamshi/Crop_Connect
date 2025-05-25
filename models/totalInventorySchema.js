let mongoose=require("mongoose");
let User=require("./loginFarmer");

const Schema=mongoose.Schema;
//inventory
const inventoryItemSchema = new Schema({
    crop: {
      type: String,
    },
    quantity: {
      type: Number,
    },
    price:{
        type:Number
    }
  });

const Inventory=mongoose.model("Inventory",inventoryItemSchema);
  
//available
const availableInventorySchema = new Schema({
    farmer: {
      type: Schema.Types.ObjectId,
      ref: "FarmerLogin",
      required: true
    },
    inventory: [inventoryItemSchema]
  });
  
const AvailableInventory = mongoose.model("AvailableInventory", availableInventorySchema);


//sold
const soldInventorySchema = new Schema({
    farmer: {
      type: Schema.Types.ObjectId,
      ref: "FarmerLogin",
      required: true
    },
    inventory: [inventoryItemSchema]
  });
  
const SoldInventory = mongoose.model("SoldInventory", soldInventorySchema);

module.exports = {
    AvailableInventory,
    SoldInventory,
    Inventory
};
  