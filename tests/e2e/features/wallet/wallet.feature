@ui
Feature: Wallet Plugin
  As a user
  I want to manage Solana wallets
  So that I can interact with the blockchain

  Background:
    Given the wallet plugin is enabled
    And I am on the wallet page

  @smoke
  Scenario: Wallet page loads
    Then I should see the wallet interface

  @wallet-crud
  Scenario: Create wallet from seed phrase
    When I click the create wallet button
    And I enter a valid seed phrase
    And I enter wallet name "Test Wallet"
    And I complete the wallet creation
    Then a wallet should be created

  @api @smoke
  Scenario: API - List wallet groups
    When I GET "/wallet/api/wallet/groups"
    Then the response should be successful

  @api
  Scenario: API - Derive addresses preview
    When I POST to "/wallet/api/wallet/derive" with a seed phrase
    Then the response should contain derived addresses
