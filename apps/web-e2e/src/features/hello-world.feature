Feature: Hello World Display
  As a user
  I want to see a Hello World message from the database
  So that I know the system is working

  Scenario: User sees Hello World message on web
    When They go to the hello world page
    Then They see "Hello World from the Database!"
    And They see the header

  Scenario: User sees Hello World message on mobile
    When They go to the hello world mobile app
    Then They see "Hello World from the Database!"
    And They see the mobile navigation

  Scenario: User sees error when database is unavailable
    Given the database is unavailable
    When They go to the hello world page
    Then They see "Failed to load message"