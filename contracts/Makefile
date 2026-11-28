# Makefile for the Foundry contracts project.
#
# The source of truth is readings/*.md. Everything under src/ and
# script/Deploy.s.sol is lambda's to generate (its solidity generator,
# asked through any host's program: the Rust host by default). Edit
# readings, run `make gen`, commit the regenerated Solidity.
#
# The generator's address is lambda's and is not settled yet: until it
# is, GEN_CONTRACTS and GEN_DEPLOY are empty and `make gen` says so
# rather than writing anything.
#
# Readings directory defaults to ./readings. Override for your own domain:
#
#   make gen READINGS=../my-app/readings
#   make test
#   make deploy-local

READINGS ?= readings
# any host's six-line program: java, js, cs, rust and wasm answer alike
HOST          ?= ../tools/rust-host/target/release/arest-host
GEN_CONTRACTS ?=
GEN_DEPLOY    ?=

.PHONY: gen gen-contracts gen-deploy build test anvil deploy-local deploy-sepolia deploy clean help

gen: gen-contracts gen-deploy ## Regenerate Solidity + deploy script from readings/
	@echo "Regenerated src/Generated.sol and script/Deploy.s.sol from $(READINGS)"

gen-contracts: ## Regenerate src/Generated.sol only
	@test -n "$(GEN_CONTRACTS)" || { echo "lambda's solidity generator has no address yet (set GEN_CONTRACTS)"; exit 1; }
	$(HOST) $(GEN_CONTRACTS) $(CURDIR)/$(READINGS) > $(CURDIR)/src/Generated.sol.build && mv $(CURDIR)/src/Generated.sol.build $(CURDIR)/src/Generated.sol

gen-deploy: ## Regenerate script/Deploy.s.sol only
	@test -n "$(GEN_DEPLOY)" || { echo "lambda's deploy generator has no address yet (set GEN_DEPLOY)"; exit 1; }
	$(HOST) $(GEN_DEPLOY) $(CURDIR)/$(READINGS) > $(CURDIR)/script/Deploy.s.sol.build && mv $(CURDIR)/script/Deploy.s.sol.build $(CURDIR)/script/Deploy.s.sol

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
