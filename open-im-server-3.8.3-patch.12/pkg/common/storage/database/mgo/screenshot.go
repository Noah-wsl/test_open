// Copyright © 2024 OpenIM. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package mgo

import (
	"context"
	"time"

	"github.com/openimsdk/open-im-server/v3/pkg/common/storage/database"
	"github.com/openimsdk/open-im-server/v3/pkg/common/storage/model"

	"github.com/openimsdk/tools/db/mongoutil"
	"github.com/openimsdk/tools/errs"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type screenshotPagination struct {
	pageNumber int32
	showNumber int32
}

func (p screenshotPagination) GetPageNumber() int32 { return p.pageNumber }
func (p screenshotPagination) GetShowNumber() int32 { return p.showNumber }

func NewScreenshotMongo(db *mongo.Database) (database.ScreenshotInterface, error) {
	coll := db.Collection(database.ScreenshotName)

	// uuid unique index
	_, err := coll.Indexes().CreateOne(context.Background(), mongo.IndexModel{
		Keys: bson.D{
			{Key: "uuid", Value: 1},
		},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return nil, errs.Wrap(err)
	}

	// user_id + create_time compound index
	_, err = coll.Indexes().CreateOne(context.Background(), mongo.IndexModel{
		Keys: bson.D{
			{Key: "user_id", Value: 1},
			{Key: "create_time", Value: -1},
		},
	})
	if err != nil {
		return nil, errs.Wrap(err)
	}

	return &ScreenshotMgo{coll: coll}, nil
}

type ScreenshotMgo struct {
	coll *mongo.Collection
}

func (s *ScreenshotMgo) Create(ctx context.Context, screenshots ...*model.Screenshot) error {
	return mongoutil.InsertMany(ctx, s.coll, screenshots)
}

func (s *ScreenshotMgo) Take(ctx context.Context, uuid string) (*model.Screenshot, error) {
	return mongoutil.FindOne[*model.Screenshot](ctx, s.coll, bson.M{"uuid": uuid, "status": 1})
}

func (s *ScreenshotMgo) FindByUserID(ctx context.Context, userID string, startTime, endTime time.Time, pageNumber, showNumber int32) ([]*model.Screenshot, int64, error) {
	filter := bson.M{
		"user_id": userID,
		"status":  1,
	}
	if !startTime.IsZero() || !endTime.IsZero() {
		tf := bson.M{}
		if !startTime.IsZero() {
			tf["$gte"] = startTime
		}
		if !endTime.IsZero() {
			tf["$lte"] = endTime
		}
		filter["create_time"] = tf
	}
	p := screenshotPagination{pageNumber: pageNumber, showNumber: showNumber}
	total, results, err := mongoutil.FindPage[*model.Screenshot](ctx, s.coll, filter, p)
	if err != nil {
		return nil, 0, err
	}
	return results, total, nil
}

func (s *ScreenshotMgo) Delete(ctx context.Context, uuid string) error {
	return mongoutil.UpdateOne(ctx, s.coll,
		bson.M{"uuid": uuid},
		bson.M{"$set": bson.M{"status": 2, "delete_time": time.Now()}},
		false,
	)
}

func (s *ScreenshotMgo) BatchDelete(ctx context.Context, uuids []string) error {
	if len(uuids) == 0 {
		return nil
	}
	return mongoutil.Ignore(mongoutil.UpdateMany(ctx, s.coll,
		bson.M{"uuid": bson.M{"$in": uuids}},
		bson.M{"$set": bson.M{"status": 2, "delete_time": time.Now()}},
	))
}
