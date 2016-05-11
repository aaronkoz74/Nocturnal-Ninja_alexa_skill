/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

        http://aws.amazon.com/apache2.0/

    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This sample shows how to create a Lambda function for handling Alexa Skill requests that:
 * - Web service: communicate with an external web service to get tide data from NOAA CO-OPS API (http://tidesandcurrents.noaa.gov/api/)
 * - Multiple optional slots: has 2 slots (city and date), where the user can provide 0, 1, or 2 values, and assumes defaults for the unprovided values
 * - DATE slot: demonstrates date handling and formatted date responses appropriate for speech
 * - Custom slot type: demonstrates using custom slot types to handle a finite set of known values
 * - Dialog and Session state: Handles two models, both a one-shot ask and tell model, and a multi-turn dialog model.
 *   If the user provides an incorrect slot in a one-shot model, it will direct to the dialog model. See the
 *   examples section for sample interactions of these models.
 * - Pre-recorded audio: Uses the SSML 'audio' tag to include an ocean wave sound in the welcome response.
 *
 * Examples:
 * One-shot model:
 *  User:  "Alexa, ask Nocturnal Ninja when is the high tide in Seattle on Saturday"
 *  Alexa: "Saturday June 20th in Seattle the first high tide will be around 7:18 am,
 *          and will peak at ...""
 * Dialog model:
 *  User:  "Alexa, open Nocturnal Ninja"
 *  Alexa: "Welcome to Nocturnal Ninja. Which city would you like tide information for?"
 *  User:  "Seattle"
 *  Alexa: "For which date?"
 *  User:  "this Saturday"
 *  Alexa: "Saturday June 20th in Seattle the first high tide will be around 7:18 am,
 *          and will peak at ...""
 */

/**
 * App ID for the skill
 */
var APP_ID = 'amzn1.echo-sdk-ams.app.f3c3b651-1a73-4c64-bafe-1f7dd9a9ae28';

/**
 * The AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');

/**
 * NocturnalNinja is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var NocturnalNinja = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
NocturnalNinja.prototype = Object.create(AlexaSkill.prototype);
NocturnalNinja.prototype.constructor = NocturnalNinja;

// ----------------------- Override AlexaSkill request and intent handlers -----------------------

NocturnalNinja.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any initialization logic goes here
};

NocturnalNinja.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    handleWelcomeRequest(response);
};

NocturnalNinja.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any cleanup logic goes here
};

/**
 * override intentHandlers to map intent handling functions.
 */
NocturnalNinja.prototype.intentHandlers = {
    "OneshotGuestListIntent": function (intent, session, response) {
        handleOneshotGuestListRequest(intent, session, response);
    },

    "DialogGuestListIntent": function (intent, session, response) {
        // Determine if this turn is for host, for show, or an error.
        // We could be passed slots with values, no slots, slots with no value.
        var showSlot = intent.slots.Show;
        var hostSlot = intent.slots.Host;
        
        if (hostSlot.value || showSlot.value) {
            handleHostDialogRequest(intent, session, response);
        } else {
            handleNoSlotDialogRequest(intent, session, response);
        }
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        handleHelpRequest(response);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    }
};

// -------------------------- NocturnalNinja Domain Specific Business Logic --------------------------

var SHOWS = {
    'the tonight show': 718,
    'the late show': 2756,
    'jimmy kimmel live': 1388
};

var HOSTS = {
    'jimmy fallon': 'the tonight show',
    'jimmy kimmel': 'jimmy kimmel live',
    'stephen colbert': 'the late show'
};

function handleWelcomeRequest(response) {
    var whichHostPrompt = "For which host would you like guest information?",
        speechOutput = {
            speech: "<speak>Welcome to Nocturnal Ninja. "
                + whichHostPrompt
                + "</speak>",
            type: AlexaSkill.speechOutputType.SSML
        },
        repromptOutput = {
            speech: "I can lead you through providing the name of the host or "
                + "show to get guest information, "
                + "or you can simply open Nocturnal Ninja and ask a question like, "
                + "who is going to be on Jimmy Kimmel? "
                + whichHostPrompt,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };

    response.ask(speechOutput, repromptOutput);
}

function handleHelpRequest(response) {
    var repromptText = "For which host would you like guest information?";
    var speechOutput = "I can lead you through providing the name of the host or "
                + "show to get guest information, "
                + "or you can simply open Nocturnal Ninja and ask a question like, "
                + "who is going to be on Jimmy Kimmel? "
        + "Or you can say exit. "
        + repromptText;

    response.ask(speechOutput, repromptText);
}

/**
 * Handles the dialog step where the user provides a host
 */

function handleHostDialogRequest(intent, session, response) {

    var showInfo = getShowHostFromIntent(intent, false),
        repromptText,
        speechOutput;
    if (showInfo.error) {
        repromptText = "Currently, I have guest information for these late night hosts: " + "Jimmy Fallon ," + "Stephen Colbert ," + "and Jimmy Kimmel. "
            + "For which host would you like guest information?";
        speechOutput = "I'm sorry, I didn't understand that name. " + repromptText;

        response.ask(speechOutput, repromptText);
        return;
    }

    getFinalGuestResponse(showInfo, response);


}

/**
 * This handles the one-shot interaction, where the user utters a phrase like:
 * 'Alexa, open Nocturnal Ninja and tell me who is going to be on Jimmy Kimmel.
 * If there is an error in a slot, this will guide the user to the dialog approach.
 */
function handleOneshotGuestListRequest(intent, session, response) {

    // Determine host, using default if none provided
    var showInfo = getShowHostFromIntent(intent, true),
        repromptText,
        speechOutput;
    if (showInfo.error) {
        // invalid show. move to the dialog
        repromptText = "Currently, I have guest information for these late night hosts: " + "Jimmy Fallon ," + "Stephen Colbert ," + "and Jimmy Kimmel. "
            + "For which host would you like guest information?";
        // if we received a value for the incorrect host, repeat it to the user, otherwise we received an empty slot
        speechOutput = showInfo.host ? "I'm sorry, I don't have any guest information for " + showInfo.host + ". " + repromptText : repromptText;

        response.ask(speechOutput, repromptText);
        return;
    }

    // all slots filled, either from the user or by default values. Move to final request
    getFinalGuestResponse(showInfo, response);
}

/**
 * Both the one-shot and dialog based paths lead to this method to issue the request, and
 * respond to the user with the final answer.
 */
function getFinalGuestResponse(showInfo, response) {

    // Issue the request, and respond to the user
    makeGuestRequest(showInfo, function guestListResponseCallback(err, guestListResponse) {
        var speechOutput;

        if (err) {
            speechOutput = "Sorry, the API used to collect the guest information is experiencing a problem. Please try again later";
        } else {
            speechOutput = "Tonight, " + showInfo + " welcomes " + guestListResponse + " to the show.";
        }

        // Need to add code to build the image url for both small and large images ... based on the host requested.  This info will be be supplied to the tellWithCard function.
        var lastName = showInfo.split(' ').slice(-1).join(' ');
        var imageFile = {
            "smallImageUrl": "https://s3.amazonaws.com/nocturnalninjaimagefiles/" + lastName + "Small.jpg",
            "largeImageUrl": "https://s3.amazonaws.com/nocturnalninjaimagefiles/" + lastName + "Large.jpg"
        };
               
        response.tellWithCard(speechOutput, "NocturnalNinja", speechOutput, imageFile)
    });
}

/**
Get today's date in format to use with API
*/
var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1; //January is 0!
    var yyyy = today.getFullYear();

    if (dd < 10) {
        dd = '0' + dd;
    } 
    if (mm < 10) {
        mm = '0' + mm;
    } 
    today = yyyy + '-' + mm +'-' + dd;
    return today;


// Jimmy Kimmel Live: 1388,
// The Tonight Show Starring Jimmy Fallon: 718,
// The Late Show With Stephen Colbert: 2756


// http://api.tvmaze.com/shows/718/episodesbydate?date=2016-05-05
//response[0].name

function makeGuestRequest(showCode, date, guestListResponseCallback) {

//The url we want is similar to: 'api.tvmaze.com/shows/718/episodesbydate?date=2016-05-05'
    var options = {
      host: 'api.tvmaze.com',
      path: '/shows/' + showCode + '/episodesbydate?date=' + date
    };

    http.request(options, function(response) {
        var tvMazeResponseString = '';

        if (response.statusCode != 200) {
            guestListResponseCallback(new Error("Non 200 Response"));
        }

        response.on('data', function (data) {
        tvMazeResponseString += data;
        });

        response.on('end', function () {
            var tvMazeResponseObject = JSON.parse(tvMazeResponseString);

            if (tvMazeResponseObject.error) {
                console.log("TV Maze error: " + tvMazeResponseObject.error.message);
                guestListResponseCallback(new Error(tvMazeResponseObject.error.message));
            } else {

                // edit the guestList so that it includes 'and' before the last guest name

                var guestList = tvMazeResponseObject[0].name;
                var guestArray = guestList.split(',');
                
                if (guestArray.length <= 1) {
                    return guestList;
                } else {
                    guestList = guestArray.slice(0, -1) + " and " + guestArray.slice(-1);
                    console.log(guestList);
                    guestListResponseCallback(null, guestList);
                }
            }
        });
    }).on('error', function (e) {
            console.log("Communications error: " + e.message);
            guestListResponseCallback(new Error(e.message));
    });
}

/**
 * Gets the show code from the intent, or returns an error
 */
function getShowHostFromIntent(intent, assignDefault) {

    var hostSlot = intent.slots.Host;
    var showSlot = intent.slots.Show;
    // slots can be missing, or slots can be provided but with empty value.
    // must test for both.
    if (!hostSlot.value && !showSlot.value) {
        if (!assignDefault) {
            return {
                error: true
            }
        } else {
            // For sample skill, default to the code for Jimmy Fallon.
            return {
                host: 'jimmy fallon',
                showCode: SHOWS["the tonight show"].toString()
            }
        }
    } else {
        // lookup the show code.
        if (hostSlot) {
            var showInfo = hostSlot.value;
            var showName = HOSTS[showInfo.toLowerCase()];
        } else if (showSlot) {
            showName = showSlot.value;
        }
        
        if (showName) {
            return {
                host: showInfo,
                showCode: SHOWS[showName].toString()
            }
        } else {
            return {
                error: true,
                host: showInfo
            }
        }
    }
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    var nocturnalNinja = new NocturnalNinja();
    nocturnalNinja.execute(event, context);
};

