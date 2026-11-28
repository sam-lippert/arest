// SPDX-License-Identifier: AGPL-3.0-or-later
// What the generated Order contract does with facts: a fact is an event, an alethic uniqueness refuses, a deontic one
// commits and records, and a transition emits its event type.
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Order} from "../src/Generated.sol";

contract OrderFactsTest is Test {
    Order internal o;

    event OrderIsPlaced(string indexed order);
    event OrderHasAmount(string indexed order, string amount);
    event OrderHasNote(string indexed order, string note);
    event CustomerCancelsOrder(string indexed customer, string order);
    event Violation(string constraint, string indexed subject);

    function setUp() public {
        o = new Order();
        o.create("ord-1");
    }

    // A transition emits the fact its event type is.
    function test_TransitionEmitsItsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit OrderIsPlaced("ord-1");
        o.place("ord-1");
    }

    // An event type of two roles takes the other role's value and says the fact in role order.
    function test_TwoRoleEventSaysBothRoles() public {
        o.place("ord-1");
        vm.expectEmit(true, false, false, true);
        emit CustomerCancelsOrder("ada", "ord-1");
        o.cancel("ord-1", "ada");
        (, bytes32 status) = o.records("ord-1");
        assertEq(status, keccak256(bytes("Cancelled")));
    }

    // A fact is asserted of a record that exists.
    function test_FactOfNoRecordReverts() public {
        vm.expectRevert(bytes("Order does not exist"));
        o.assertOrderHasAmount("ord-9", "12.50");
    }

    // A fact asserted is an event, and is held.
    function test_FactIsAnEvent() public {
        vm.expectEmit(true, false, false, true);
        emit OrderHasAmount("ord-1", "12.50");
        o.assertOrderHasAmount("ord-1", "12.50");
        assertEq(o.orderHasAmount("ord-1"), "12.50");
    }

    // A fact already held is not asserted again: no second event.
    function test_FactHeldIsNotAssertedAgain() public {
        o.assertOrderHasAmount("ord-1", "12.50");
        vm.recordLogs();
        o.assertOrderHasAmount("ord-1", "12.50");
        assertEq(vm.getRecordedLogs().length, 0);
    }

    // An alethic uniqueness refuses a second value.
    function test_AlethicUniquenessRefuses() public {
        o.assertOrderHasAmount("ord-1", "12.50");
        vm.expectRevert(bytes("UC: Each Order has at most one Amount"));
        o.assertOrderHasAmount("ord-1", "13.00");
    }

    // A deontic uniqueness commits the second value and records the violation.
    function test_DeonticUniquenessCommitsAndRecords() public {
        o.assertOrderHasNote("ord-1", "leave at the door");
        vm.expectEmit(true, false, false, true);
        emit Violation("DEO:u:OrderIsInvolvedInOrderHasNote#1", "ord-1");
        vm.expectEmit(true, false, false, true);
        emit OrderHasNote("ord-1", "ring twice");
        o.assertOrderHasNote("ord-1", "ring twice");
        assertEq(o.orderHasNote("ord-1"), "ring twice");
    }
}
