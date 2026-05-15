1- The UI should either be in full English (the default language) or in full Arabic (switchable) but not a mix of the two languages. The teller type of users should also be able to switch between the two languages: English or Arabic.
2- Numbers are always in English language format.
3- Upon login, the user should have the possibility to see/ view the entered password.
4- If possible, enable multi-factor authentication using the Windows MicroSoft Authenticator.
5- For each of the currencies display the country flag as part of the currency name, similar to what is normally displayed in Currency Exchange boards.
6- Consider a place for company logo at top, the logo should support the flexibility to be uploaded by admin user
7- Once the sell/ buy transaction is completed, it should be possible to print a receipt for the customer with details of the transaction and company logo.
8- It should be possible to automatically send the receipt in customer mail. this capability should be readily available in the system.
9- Create a solution document that explains the details of the solution end 2 end, explaining its different components and the different work flows. Also develop a complete user guide, showing user how to install the system in different environments: local, AWS, Azure, Google, Contabo, etc...
10- The admin shoud have the flexibility to enable/allow access to different sections within the system for teller-type of users.
11- Answer the following questions:
    a) How scalable is the system? For how long can the default pre-built DB keep the data?
    b) Is it possible to backup the system and use that backup to restore the system some where else, so it fully supports the portability from one platform to another?
    c) State the system requirement in case hosted in a local machine or a public cloud provider.
12- Add a tab for current balances that reflects real time balances of all the currencies. The balances should be updated automatically based on the buy and sell transactions on top of the opening balances.
13- Under settings remove the following: Changing language will reload the page and apply RTL layout for Arabic.
14- Create a SW QA agent that can run untensive testing on the system, so it discovers and report any issues. In case of issues, make sure to fix them.
15- Prompt the admin and teller type of users to change their passwords on the first login.
16- Craft a very restrictive password policy, length and combination wise.
----------
17- Add a possibility to forgot and reset password by email sent to the user
18- All users including the admin should be forced to change their password at the first login
19- Populate the system with reasonable data so I can test the different functionalities like selling, buying, current balance, opening balance, etc... Also populate the reports, so I see a sample of them.
20- Add the possibility for admin to delete a user, except for the admin user
21- Update flags under the 'Currencies' tab
22- Put currency full name between paranthesis under the 'Exchange Rate' tab
23- Under 'Opening Balances) add the flag before the abbreviation and the full name within paranthesis after it, so the user don't get confused on what the abbreviation would mean. Use the same format under 'Exchange Rates'
24- Company logo should also be available in login page (before user logs in)
