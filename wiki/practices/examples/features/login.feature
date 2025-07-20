Feature: User Authentication and Navigation

# This scenario tests the complete login flow from homepage to credit application.
# The navigation path follows: Homepage � Sign In � Login � Homepage � User Homepage � Credit Form
Scenario: Successful login and navigation to credit application
  Given they are on the home page
  When they sign in as "Tom Smith"
  Then they are redirected to the home page
  And they can navigate to the user homepage
  And they can access the credit application form

# This scenario tests login with invalid credentials to ensure proper error handling.
# Invalid credentials should display appropriate error messages without proceeding.
Scenario: Failed login with invalid credentials
  Given they are on the home page
  When they attempt to sign in with invalid credentials
  Then they see login error messages
  And they remain on the login page

# This scenario tests the logout functionality to ensure users can properly sign out.
# After logout, users should be redirected appropriately and lose access to protected areas.
Scenario: Successful logout from user session
  Given "Mike Fog" is logged in
  And they are on the user homepage
  When they log out
  Then they are redirected to the login page
  And they cannot access protected areas without authentication