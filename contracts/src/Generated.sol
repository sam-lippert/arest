// Generated from readings by AREST
pragma solidity ^0.8.20;

contract Order {
    struct Data {
        string id;
        bytes32 status;
    }

    mapping(string => Data) public records;
    mapping(string => string) public orderWasPlacedByCustomer;
    mapping(string => string) public orderHasAmount;
    mapping(string => string) public orderHasNote;

    event OrderWasPlacedByCustomer(string indexed order, string customer);
    event OrderHasAmount(string indexed order, string amount);
    event OrderHasNote(string indexed order, string note);
    event OrderIsPlaced(string indexed order);
    event OrderIsShipped(string indexed order);
    event OrderIsArchived(string indexed order);
    event CustomerCancelsOrder(string indexed customer, string order);
    event Violation(string constraint, string indexed subject);

    function create(string memory id) external {
        require(bytes(records[id].id).length == 0, "UC: Order already exists");
        records[id].id = id;
        records[id].status = keccak256(bytes("In Cart"));
    }

    function archive(string memory id) external {
        require(records[id].status == keccak256(bytes("Shipped")), "SM: wrong state");
        records[id].status = keccak256(bytes("Archived"));
        emit OrderIsArchived(id);
    }

    function cancel(string memory id, string memory customer) external {
        require(records[id].status == keccak256(bytes("Placed")), "SM: wrong state");
        records[id].status = keccak256(bytes("Cancelled"));
        emit CustomerCancelsOrder(customer, id);
    }

    function place(string memory id) external {
        require(records[id].status == keccak256(bytes("In Cart")), "SM: wrong state");
        records[id].status = keccak256(bytes("Placed"));
        emit OrderIsPlaced(id);
    }

    function ship(string memory id) external {
        require(records[id].status == keccak256(bytes("Placed")), "SM: wrong state");
        records[id].status = keccak256(bytes("Shipped"));
        emit OrderIsShipped(id);
    }

    function assertOrderWasPlacedByCustomer(string memory id, string memory customer) external {
        require(bytes(records[id].id).length != 0, "Order does not exist");
        if (keccak256(bytes(orderWasPlacedByCustomer[id])) == keccak256(bytes(customer))) return;
        require(bytes(orderWasPlacedByCustomer[id]).length == 0, "UC: Each Order was placed by exactly one Customer");
        orderWasPlacedByCustomer[id] = customer;
        emit OrderWasPlacedByCustomer(id, customer);
    }

    function assertOrderHasAmount(string memory id, string memory amount) external {
        require(bytes(records[id].id).length != 0, "Order does not exist");
        if (keccak256(bytes(orderHasAmount[id])) == keccak256(bytes(amount))) return;
        require(bytes(orderHasAmount[id]).length == 0, "UC: Each Order has at most one Amount");
        orderHasAmount[id] = amount;
        emit OrderHasAmount(id, amount);
    }

    function assertOrderHasNote(string memory id, string memory note) external {
        require(bytes(records[id].id).length != 0, "Order does not exist");
        if (keccak256(bytes(orderHasNote[id])) == keccak256(bytes(note))) return;
        if (bytes(orderHasNote[id]).length != 0) emit Violation("It is obligatory that each Order has at most one Note", id);
        orderHasNote[id] = note;
        emit OrderHasNote(id, note);
    }
}

