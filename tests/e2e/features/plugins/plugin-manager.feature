@ui
Feature: Plugin Manager
  As a user
  I want to manage plugins
  So that I can extend application functionality

  Background:
    Given I am on the plugin manager page

  @smoke
  Scenario: Plugin manager loads
    Then I should see the "Plugin Manager" heading
    And I should see installed plugins

  @smoke
  Scenario: View installed plugins
    Then I should see "void-plugin-wallet" in the list
    And I should see "void-plugin-ascii" in the list
    And I should see "void-plugin-verify" in the list

  Scenario: Built-in plugins have badge
    Then the "void-plugin-wallet" should have a "built-in" badge

  Scenario: Toggle plugin enabled state
    When I toggle the "void-plugin-ascii" plugin
    Then I should see the restart required message

  @api @smoke
  Scenario: API - List plugins
    When I GET "/api/plugins"
    Then the response should contain installed plugins
    And the response should contain available plugins

  @api
  Scenario: API - Cannot uninstall built-in plugin
    When I try to DELETE "/api/plugins/void-plugin-wallet"
    Then the response should indicate failure
