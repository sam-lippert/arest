# Makefile for the Foundry contracts project.
#
# The source of truth is readings/*.md. Everything under src/ and
# script/Deploy.s.sol is lambda's to generate, asked through any host's
# program (the Rust host by default; HOST names another). `make gen` is
# two steps: the readings are checked as a small library package over the
# metamodel's base (apps_check, as an app is), which leaves its store, then
# lambda is asked, over that store, for the
# contracts (solidity <Object Type...>) and the Foundry script that makes
# them (solidity-deploy <Object Type...>). With no object types named,
# lambda answers every machine in the store, the metamodel's own included,
# so OBJECTS names the fixture's. Edit readings, run `make gen`, commit
# the regenerated Solidity.
#
# Readings directory defaults to ./readings. Override for your own domain:
#
#   make gen READINGS=../my-app/readings
#   make test
#   make deploy-local

READINGS ?= readings
# any host's six-line program: java, js, cs, rust and wasm answer alike
ROOT    := $(abspath $(CURDIR)/..)
HOST    ?= $(ROOT)/tools/rust-host/target/release/arest-host
BASE    ?= $(ROOT)/tools/base
STORE   ?= $(CURDIR)/.store
OBJECTS ?= Order
LAMBDA  := AREST_LAMBDA=$(ROOT)/arest AREST_TESTS=$(ROOT)/arest.tests AREST_SCENARIOS=$(ROOT)/engine/shared/scenarios.canon

.PHONY: gen gen-store gen-contracts gen-deploy build test anvil deploy-local deploy-sepolia deploy clean help

gen: gen-contracts gen-deploy ## Regenerate Solidity + deploy script from readings/
	@echo "Regenerated src/Generated.sol and script/Deploy.s.sol from $(READINGS)"

gen-store: ## Check readings/ as a library package over the metamodel's base, leaving its store
	rm -rf $(STORE) && mkdir -p $(STORE)/pkg $(STORE)/db
	cp $(CURDIR)/$(READINGS)/*.md $(STORE)/pkg/
	printf '{ "name": "contracts-readings", "version": "0.0.0", "private": true, "kind": "library" }
' > $(STORE)/pkg/package.json
	$(LAMBDA) AREST_CARRIERS=$(BASE) $(HOST) apps_check $(STORE)/pkg $(STORE)/db

gen-contracts: gen-store ## Regenerate src/Generated.sol only
	$(LAMBDA) AREST_CARRIERS=$(STORE)/db $(HOST) solidity $(OBJECTS) > $(CURDIR)/src/Generated.sol.build && mv $(CURDIR)/src/Generated.sol.build $(CURDIR)/src/Generated.sol

gen-deploy: gen-store ## Regenerate script/Deploy.s.sol only
	$(LAMBDA) AREST_CARRIERS=$(STORE)/db $(HOST) solidity-deploy $(OBJECTS) > $(CURDIR)/script/Deploy.s.sol.build && mv $(CURDIR)/script/Deploy.s.sol.build $(CURDIR)/script/Deploy.s.sol

build: ## forge build
	forge build

test: build ## forge test -vv
	forge test -vv

anvil: ## Start a local Anvil chain on :8545
	anvil

# Anvil's well-known first account. Funded with 10k ETH on local chains.
ANVIL_KEY := 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

deploy-local: build ## Deploy every user contract to local Anvil
	@echo "Make sure 'make anvil' is running in another terminal."
	forge script script/Deploy.s.sol \
		--rpc-url http://localhost:8545 \
		--private-key $(ANVIL_KEY) \
		--broadcast

deploy-sepolia: build ## Deploy to Sepolia testnet (env: SEPOLIA_RPC_URL, PRIVATE_KEY)
	forge script script/Deploy.s.sol \
		--rpc-url $${SEPOLIA_RPC_URL} \
		--private-key $${PRIVATE_KEY} \
		--broadcast \
		--verify

deploy-optimism: build ## Deploy to Optimism mainnet (env: OPTIMISM_RPC_URL, PRIVATE_KEY)
	forge script script/Deploy.s.sol \
		--rpc-url $${OPTIMISM_RPC_URL} \
		--private-key $${PRIVATE_KEY} \
		--broadcast \
		--verify

deploy-arbitrum: build ## Deploy to Arbitrum One (env: ARBITRUM_RPC_URL, PRIVATE_KEY)
	forge script script/Deploy.s.sol \
		--rpc-url $${ARBITRUM_RPC_URL} \
		--private-key $${PRIVATE_KEY} \
		--broadcast \
		--verify

deploy-polygon: build ## Deploy to Polygon PoS (env: POLYGON_RPC_URL, PRIVATE_KEY)
	forge script script/Deploy.s.sol \
		--rpc-url $${POLYGON_RPC_URL} \
		--private-key $${PRIVATE_KEY} \
		--broadcast \
		--verify

deploy-linea: build ## Deploy to Linea (env: LINEA_RPC_URL, PRIVATE_KEY)
	forge script script/Deploy.s.sol \
		--rpc-url $${LINEA_RPC_URL} \
		--private-key $${PRIVATE_KEY} \
		--broadcast \
		--verify

deploy-zksync: build ## Deploy to zkSync Era (env: ZKSYNC_RPC_URL, PRIVATE_KEY)
	forge script script/Deploy.s.sol \
		--rpc-url $${ZKSYNC_RPC_URL} \
		--private-key $${PRIVATE_KEY} \
		--broadcast \
		--verify

deploy: build ## Deploy to an arbitrary chain (env: RPC_URL, PRIVATE_KEY)
	forge script script/Deploy.s.sol \
		--rpc-url $${RPC_URL} \
		--private-key $${PRIVATE_KEY} \
		--broadcast

clean: ## Remove Foundry build artifacts
	forge clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'
