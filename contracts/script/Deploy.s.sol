// Generated from readings by AREST
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Order} from "../src/Generated.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        Order order = new Order();
        console.log("Order deployed at:", address(order));
        vm.stopBroadcast();
    }
}

