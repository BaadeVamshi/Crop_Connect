const mongoose=require("mongoose");
let farmer=require("./loginFarmer");
let Schema=mongoose.Schema;
let buyer=require("./loginbuyer");
const requestSchema=new Schema({
     farmer: {
      type: Schema.Types.ObjectId,
      ref: "FarmerLogin",
      required: true
    },
    buyer:{
        type:Schema.Types.ObjectId,
        ref:"BuyerLogin",
        required:true
    },
    order:{
        type:String,
        enum:["accepted","rejected","pending"],
        default:"pending",
    },
    inventorySent:[
        {
            crop:String,
            quantity:Number,
            price:Number
        }
    ],
    inventoryaccepted:[
        {
            crop:String,
            quantity:Number,
            price:Number
        }
    ],
     createdAt: {
        type: Date,
        default: Date.now
    }
});
module.exports=mongoose.model("Request",requestSchema);